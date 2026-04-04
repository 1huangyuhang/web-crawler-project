/**
 * JWT认证中间件
 * 提供API访问认证和权限控制
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * 生成JWT令牌
 * @param {Object} payload - 令牌载荷
 * @param {string} expiresIn - 过期时间
 * @returns {string} JWT令牌
 */
function generateToken(payload, expiresIn = '24h') {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * 验证JWT令牌
 * @param {string} token - JWT令牌
 * @returns {Object} 解码后的载荷
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  return jwt.verify(token, secret);
}

/**
 * JWT认证中间件
 * 验证请求中的JWT令牌
 */
function authMiddleware(req, res, next) {
  // 允许某些路由不需要认证（挂载在 app.use('/api', authMiddleware) 时 req.path 不含 /api 前缀）
  const publicRoutes = ['/api/health', '/api/auth/login', '/api/auth/register', '/health', '/auth/login', '/auth/register'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // 本地开发：只读历史、统计与系统设置（与前端 Redux / api 对齐）
  if (req.method === 'GET' && (req.path === '/history' || req.path === '/history/stats')) {
    return next();
  }
  if (req.path === '/settings' && (req.method === 'GET' || req.method === 'PUT')) {
    return next();
  }
  if (req.method === 'GET' && req.path.startsWith('/analytics/')) {
    return next();
  }

  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: '未提供有效的认证令牌',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.substring(7); // 移除 "Bearer "
    const decoded = verifyToken(token);

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: '无效的认证令牌',
        timestamp: new Date().toISOString()
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: '认证令牌已过期',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '认证处理失败',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * API密钥认证中间件
 * 用于服务间通信的认证
 */
function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'your-api-key-change-in-production';

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: '无效的API密钥',
      timestamp: new Date().toISOString()
    });
  }

  next();
}

/**
 * 生成API密钥
 * @param {string} prefix - 密钥前缀
 * @returns {string} 生成的API密钥
 */
function generateApiKey(prefix = 'sk') {
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('hex');
  return `${prefix}_${key}`;
}

/**
 * 认证检查中间件
 * 仅检查令牌有效性，不强制要求认证
 */
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      req.user = decoded;
    }
  } catch (error) {
    // 忽略错误，继续处理
  }

  next();
}

module.exports = {
  authMiddleware,
  apiKeyMiddleware,
  optionalAuthMiddleware,
  generateToken,
  verifyToken,
  generateApiKey
};