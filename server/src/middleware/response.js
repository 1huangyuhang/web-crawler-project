/**
 * 标准化响应格式中间件
 * 统一成功和错误响应结构
 */

/**
 * 成功响应格式化
 * @param {Object} data - 响应数据
 * @param {string} message - 成功消息
 * @param {number} code - 成功码 (0表示成功)
 * @returns {Object} 格式化后的响应对象
 */
function successResponse(data = null, message = '操作成功', code = 0) {
  return {
    success: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * 错误响应格式化
 * @param {string} message - 错误消息
 * @param {string} code - 错误码
 * @param {Object} details - 错误详情
 * @returns {Object} 格式化后的错误响应对象
 */
function errorResponse(message = '操作失败', code = 'INTERNAL_ERROR', details = null) {
  return {
    success: false,
    code,
    message,
    data: null,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 成功响应中间件
 */
function sendSuccess(req, res, data, message = '操作成功') {
  return res.json(successResponse(data, message));
}

/**
 * 错误响应中间件
 */
function sendError(req, res, error, statusCode = 500) {
  // 处理已知的错误类型
  if (error.code && error.message) {
    // 标准化错误对象
    return res.status(statusCode).json(errorResponse(
      error.message,
      error.code,
      error.details || null
    ));
  }

  // 处理Error对象
  if (error instanceof Error) {
    return res.status(statusCode).json(errorResponse(
      error.message,
      'INTERNAL_ERROR'
    ));
  }

  // 处理其他错误
  return res.status(statusCode).json(errorResponse(
    typeof error === 'string' ? error : '未知错误',
    'INTERNAL_ERROR'
  ));
}

/**
 * 404处理中间件
 */
function notFound(req, res) {
  return res.status(404).json(errorResponse(
    '接口不存在',
    'NOT_FOUND'
  ));
}

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('全局错误:', err);

  // 处理特定错误类型
  if (err.name === 'ValidationError') {
    return res.status(400).json(errorResponse(
      '参数验证失败',
      'VALIDATION_ERROR',
      err.errors
    ));
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json(errorResponse(
      '未授权访问',
      'UNAUTHORIZED'
    ));
  }

  // 默认错误处理
  return res.status(err.status || 500).json(errorResponse(
    err.message || '服务器内部错误',
    err.code || 'INTERNAL_ERROR',
    err.details || null
  ));
}

module.exports = {
  successResponse,
  errorResponse,
  sendSuccess,
  sendError,
  notFound,
  errorHandler
};