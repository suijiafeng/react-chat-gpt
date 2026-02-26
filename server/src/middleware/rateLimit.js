// 轻量内存限流中间件（固定窗口计数）。
//
// 目的：防止已登录用户短时间内狂刷代理接口，导致上游 API 费用失控 / 连接被占满。
// 单机内存实现，零外部依赖；多实例部署时应换成基于 Redis 的共享计数。

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 30,
  keyFn = (req) => req.ip,
  message = '请求过于频繁，请稍后再试',
} = {}) => {
  const hits = new Map(); // key -> { count, reset }

  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);

    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: `${message}（约 ${retryAfter} 秒后重试）` });
    }

    // 顺带清理已过期的 key，避免 Map 随不同用户/IP 无限增长
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }

    next();
  };
};
