// 校验 session 是否已登录，未登录统一返回 401（不同 open-webui 的错误结构，
// 但前端只关心状态码 + message，够用）
export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: '未登录或登录已过期' });
  }
  next();
};
