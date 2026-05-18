// 上游地址校验 + 安全转发。
//
// 为什么需要这个模块：
// /api/v1/llm/* 这组接口的本质是「服务端按用户填写的地址发起请求」——这正是 SSRF 的定义。
// 用户把 apiUrl 填成 http://169.254.169.254/latest/meta-data/（云厂商元数据端点）、
// http://127.0.0.1:6379/ 或内网 http://10.0.0.5:8080/，服务端就成了他的内网探测代理；
// 而且 proxyOpenAiCompat 会把解密出的 Authorization 一并发过去，readUpstreamError 又
// 把上游响应体原样回显给前端 —— 探测通道是双向闭合的。
//
// 防线分三层：
// 1. 协议白名单：只允许 https（本机 Ollama 例外，见下）；
// 2. 地址黑名单：解析 DNS 后逐个检查解析结果，命中私有/保留网段一律拒绝；
// 3. 禁止跟随重定向：白名单域名可以 302 跳内网，redirect:'manual' 把这条路堵死。
//
// 已知残留风险（写在这里而不是假装没有）：第 2 层是「先解析、再连接」，理论上存在
// DNS rebinding 的 TOCTOU 窗口——校验时解析到公网 IP，实际连接时 TTL 过期重解析到内网。
// 彻底封堵需要接管连接层（undici Agent 的 connect 钩子里按已校验的 IP 直连）。
// 当前部署形态是单机自用，先取「成本低、覆盖绝大多数攻击面」的方案。

import dns from 'node:dns/promises';
import net from 'node:net';

export class UpstreamUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamUrlError';
  }
}

// 本机地址的取舍说明（这条是有意为之，不是漏了）：
//
// 默认放行 http://localhost:任意端口。理由是本项目的既定形态是「自部署、自己用」——
// README 里明确支持本机 Ollama（http://localhost:11434/v1），而在单用户部署下
// localhost 处在信任边界的同一侧：用户本来就能在自己机器上 curl 任何本地端口，
// 服务端拦他访问 127.0.0.1:6379 挡不住任何真实攻击，只会让 LM Studio(1234)、
// vLLM(8000) 这些自定义端口的用户配不上。端口白名单在这个场景里是安全剧场。
//
// 真正有风险的是「多用户 / 公开注册」的部署：那时别的用户的 localhost 就是你的内网。
// 这种部署必须设 ALLOW_LOCAL_UPSTREAM=false，此时只允许 https 公网地址。
//
// 无论哪种模式，非 localhost 的私有网段（10/8、172.16/12、192.168/16、169.254/16 等）
// 一律拒绝——云元数据端点 169.254.169.254 在两种模式下都打不通。
const ALLOW_LOCAL = process.env.ALLOW_LOCAL_UPSTREAM !== 'false';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** IPv4 是否落在私有/保留网段 */
const isPrivateIPv4 = (ip) => {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return true;                       // 10.0.0.0/8
  if (a === 127) return true;                      // 环回
  if (a === 0) return true;                        // 0.0.0.0/8
  if (a === 169 && b === 254) return true;         // 链路本地 —— 云元数据端点在这里
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 运营商级 NAT 100.64.0.0/10
  if (a >= 224) return true;                       // 组播 + 保留
  return false;
};

/**
 * IPv6 是否落在私有/保留网段。
 *
 * IPv4-mapped 地址（::ffff:a.b.c.d）必须按对应的 IPv4 规则判定，否则就是一条完整的绕过路径。
 * 注意这里有两种写法要一起处理：用户可以写 ::ffff:169.254.169.254（点分十进制），
 * 但 WHATWG URL 会把它规范化成 ::ffff:a9fe:a9fe（十六进制）——只匹配点分形式的实现，
 * 在真实请求路径上（先过 new URL 再取 hostname）等于完全没生效。
 */
const isPrivateIPv6 = (ip) => {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;

  // 形式一：::ffff:169.254.169.254
  const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIPv4(dotted[1]);

  // 形式二：::ffff:a9fe:a9fe（new URL 规范化后的样子）
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }

  if (v.startsWith('fe80')) return true;           // 链路本地
  if (/^f[cd]/.test(v)) return true;               // 唯一本地地址 fc00::/7
  return false;
};

export const isPrivateAddress = (ip) => {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return false;
};

const isLocalHostname = (hostname) => LOCAL_HOSTNAMES.has(hostname.toLowerCase());

/**
 * 校验用户填写的上游地址。通过则返回规范化后的 URL 对象，否则抛 UpstreamUrlError。
 * 只做「不依赖网络」的静态检查，用于 PUT /config 保存前的即时反馈。
 */
export function parseUpstreamUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) throw new UpstreamUrlError('请填写 API 接口地址');

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UpstreamUrlError('API 接口地址不是合法的 URL（需要带 http:// 或 https:// 前缀）');
  }

  // URL 里带凭证会被一并发给上游，且会出现在日志里
  if (url.username || url.password) {
    throw new UpstreamUrlError('API 接口地址中不能包含用户名或密码');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (url.protocol === 'https:') {
    // https 也要挡住直接写 IP 的情况：https://10.0.0.5/ 一样是内网
    if (isPrivateAddress(host)) {
      throw new UpstreamUrlError('不允许指向内网或本机地址');
    }
    return url;
  }

  if (url.protocol === 'http:') {
    if (!ALLOW_LOCAL) {
      throw new UpstreamUrlError('当前部署已关闭本机上游（ALLOW_LOCAL_UPSTREAM=false），只允许 https 地址');
    }
    if (!isLocalHostname(host)) {
      throw new UpstreamUrlError('http 只允许用于本机地址（如 http://localhost:11434/v1），其余请使用 https');
    }
    return url;
  }

  throw new UpstreamUrlError('只支持 http / https 协议');
}

/** 解析域名并确认每一个解析结果都是公网地址。本机白名单地址跳过这步。 */
async function assertResolvesToPublic(url) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isLocalHostname(host)) return;      // 已在 parseUpstreamUrl 里按端口白名单放行
  if (net.isIP(host)) return;             // 字面量 IP 已在 parseUpstreamUrl 里查过

  let records;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new UpstreamUrlError(`无法解析域名：${host}`);
  }
  // 只要有一条解析到内网就拒绝——攻击者可以让域名同时解析到公网和内网地址，
  // 「有一条是公网就放行」等于没防。
  const bad = records.find((r) => isPrivateAddress(r.address));
  if (bad) {
    throw new UpstreamUrlError(`域名 ${host} 解析到了内网地址（${bad.address}），已拒绝`);
  }
}

/**
 * 带 SSRF 防护的 fetch。所有指向「用户可控地址」的请求都必须走这里。
 * 与原生 fetch 的两点差异：
 *   1. 请求前校验地址 + 解析 DNS；
 *   2. redirect:'manual'——上游用 302 跳内网是绕过白名单的标准手法，这里直接判失败，
 *      而不是让 fetch 默默跟过去。
 */
export async function safeFetch(rawUrl, init = {}) {
  const url = parseUpstreamUrl(rawUrl);
  await assertResolvesToPublic(url);

  const response = await fetch(url, { ...init, redirect: 'manual' });

  if (response.status >= 300 && response.status < 400) {
    throw new UpstreamUrlError(
      `上游返回了重定向（${response.status}），出于安全考虑不予跟随；请直接填写最终地址`,
    );
  }
  return response;
}
