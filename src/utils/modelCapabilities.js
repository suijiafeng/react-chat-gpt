// 模型能力启发式判断。
//
// OpenAI 兼容协议的 /models 接口不返回能力信息，只能按模型名猜测。
// 判断结果只用于「软提示」（如提醒用户当前模型可能不支持图片），
// 不做硬拦截——猜错时用户依然可以发送，由上游 API 返回真实错误。

const VISION_PATTERNS = [
  /gpt-4o/i,
  /gpt-4\.\d/i,
  /gpt-5/i,
  /\bo[34]\b/i,
  /claude/i, // Claude 3+ 全系支持视觉
  /gemini/i,
  /qwen[^\s]*-?vl/i,
  /qvq/i,
  /glm-4v/i,
  /glm-4\.\d v?/i,
  /vision/i,
  /pixtral/i,
  /llava/i,
  /internvl/i,
  /minicpm-v/i,
  /kimi/i,
  /moonshot-v1-.*vision/i,
  /grok-(?:1\.5v|vision|[3-9])/i,
  /llama-?[34].*(?:vision|maverick|scout)/i,
  /step-1v/i,
  /yi-vision/i,
];

/** 该模型（按名字猜测）是否支持图片输入 */
export const isLikelyVisionModel = (modelName) => {
  if (!modelName) return false;
  return VISION_PATTERNS.some((re) => re.test(modelName));
};
