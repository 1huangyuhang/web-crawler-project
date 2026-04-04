/**
 * 输入验证中间件
 * 使用zod进行严格的数据验证和消毒
 */

const z = require('zod');

/**
 * 爬取请求验证模式
 */
const crawlRequestSchema = z.object({
  type: z.enum(['link', 'content', 'image'], {
    required_error: '爬虫类型是必需的',
    invalid_type_error: '无效的爬虫类型'
  }),
  url: z.string({
    required_error: '目标URL是必需的'
  }).url({
    message: '无效的URL格式'
  }).max(2048, {
    message: 'URL长度不能超过2048个字符'
  }),
  depth: z.number({
    coerce: true // 自动类型转换
  }).int({
    message: '爬取深度必须是整数'
  }).min(1, {
    message: '爬取深度至少为1'
  }).max(10, {
    message: '爬取深度不能超过10'
  }).default(2)
});

/**
 * 历史记录查询验证模式
 */
const historyQuerySchema = z.object({
  limit: z.number({
    coerce: true
  }).int({
    message: '限制数量必须是整数'
  }).min(1, {
    message: '限制数量至少为1'
  }).max(1000, {
    message: '限制数量不能超过1000'
  }).default(50),
  offset: z.number({
    coerce: true
  }).int({
    message: '偏移量必须是整数'
  }).min(0, {
    message: '偏移量不能为负数'
  }).default(0)
});

/**
 * ID参数验证模式
 */
const idParamSchema = z.object({
  id: z.string({
    required_error: 'ID是必需的'
  }).regex(/^[a-zA-Z0-9_-]{1,100}$/, {
    message: '无效的ID格式'
  })
});

/**
 * 分页查询验证模式
 */
const paginationSchema = z.object({
  page: z.number({
    coerce: true
  }).int({
    message: '页码必须是整数'
  }).min(1, {
    message: '页码至少为1'
  }).default(1),
  limit: z.number({
    coerce: true
  }).int({
    message: '每页数量必须是整数'
  }).min(1, {
    message: '每页数量至少为1'
  }).max(100, {
    message: '每页数量不能超过100'
  }).default(10)
});

/**
 * 用户注册验证模式
 */
const userRegisterSchema = z.object({
  username: z.string({
    required_error: '用户名是必需的'
  }).min(3, {
    message: '用户名至少需要3个字符'
  }).max(50, {
    message: '用户名不能超过50个字符'
  }).regex(/^[a-zA-Z0-9_-]+$/, {
    message: '用户名只能包含字母、数字、下划线和连字符'
  }),
  email: z.string({
    required_error: '邮箱是必需的'
  }).email({
    message: '无效的邮箱格式'
  }).max(100, {
    message: '邮箱不能超过100个字符'
  }),
  password: z.string({
    required_error: '密码是必需的'
  }).min(8, {
    message: '密码至少需要8个字符'
  }).max(128, {
    message: '密码不能超过128个字符'
  }).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '密码必须包含大小写字母和数字'
  })
});

/**
 * 用户登录验证模式
 */
const userLoginSchema = z.object({
  username: z.string({
    required_error: '用户名是必需的'
  }).max(50, {
    message: '用户名不能超过50个字符'
  }),
  password: z.string({
    required_error: '密码是必需的'
  }).max(128, {
    message: '密码不能超过128个字符'
  })
});

/**
 * API密钥验证模式
 */
const apiKeySchema = z.object({
  name: z.string({
    required_error: 'API密钥名称是必需的'
  }).min(3, {
    message: '名称至少需要3个字符'
  }).max(50, {
    message: '名称不能超过50个字符'
  }),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read'])
});

/**
 * 通用验证中间件
 * @param {z.Schema} schema - zod验证模式
 * @param {string} source - 验证数据来源 (body, query, params)
 * @returns {Function} 验证中间件
 */
function validateMiddleware(schema, source = 'body') {
  return (req, res, next) => {
    try {
      // 获取验证数据
      const data = req[source];
      if (!data) {
        return res.status(400).json({
          success: false,
          code: 'BAD_REQUEST',
          message: '请求数据不能为空',
          timestamp: new Date().toISOString()
        });
      }

      // 验证和消毒数据
      const validatedData = schema.parse(data);

      // 将验证后的数据保存到请求对象
      req.validatedData = validatedData;
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // 格式化验证错误信息
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(422).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: '输入验证失败',
          errors: errors,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: '验证处理失败',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * 爬取请求验证中间件
 */
function validateCrawlRequest(req, res, next) {
  return validateMiddleware(crawlRequestSchema, 'body')(req, res, next);
}

/**
 * 历史记录查询验证中间件
 */
function validateHistoryRequest(req, res, next) {
  return validateMiddleware(historyQuerySchema, 'query')(req, res, next);
}

/**
 * ID参数验证中间件
 */
function validateIdParam(req, res, next) {
  return validateMiddleware(idParamSchema, 'params')(req, res, next);
}

/**
 * 分页查询验证中间件
 */
function validatePagination(req, res, next) {
  return validateMiddleware(paginationSchema, 'query')(req, res, next);
}

/**
 * 用户注册验证中间件
 */
function validateUserRegister(req, res, next) {
  return validateMiddleware(userRegisterSchema, 'body')(req, res, next);
}

/**
 * 用户登录验证中间件
 */
function validateUserLogin(req, res, next) {
  return validateMiddleware(userLoginSchema, 'body')(req, res, next);
}

/**
 * API密钥创建验证中间件
 */
function validateApiKeyCreate(req, res, next) {
  return validateMiddleware(apiKeySchema, 'body')(req, res, next);
}

/**
 * 速率限制中间件
 * 限制每个IP的请求频率
 */
// express-rate-limit 模块未安装，注释掉相关代码
// const rateLimit = require('express-rate-limit');

// function createRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 100) {
//   return rateLimit({
//     windowMs: windowMs, // 时间窗口（毫秒）
//     max: maxRequests, // 最大请求数
//     message: {
//       success: false,
//       code: 'RATE_LIMIT_EXCEEDED',
//       message: '请求过于频繁，请稍后再试',
//       timestamp: new Date().toISOString()
//     },
//     standardHeaders: true, // 返回RateLimit头信息
//     legacyHeaders: false, // 不返回X-RateLimit头信息
//     keyGenerator: (req) => {
//       // 使用IP地址作为键
//       return req.ip || req.connection.remoteAddress;
//     },
//     handler: (req, res) => {
//       // 自定义速率限制响应
//       res.status(429).json({
//         success: false,
//         code: 'RATE_LIMIT_EXCEEDED',
//         message: '请求过于频繁，请稍后再试',
//         retryAfter: Math.ceil(windowMs / 1000),
//         timestamp: new Date().toISOString()
//       });
//     }
//   });
// }

/**
 * API密钥速率限制
 * 更严格的限制
 */
function apiKeyRateLimiter(req, res, next) {
  // 速率限制功能已禁用，直接通过
  return next();
}

/**
 * 爬取请求速率限制
 * 限制爬取频率
 */
function crawlRateLimiter(req, res, next) {
  // 速率限制功能已禁用，直接通过
  return next();
}

module.exports = {
  // 验证中间件
  validateMiddleware,
  validateCrawlRequest,
  validateHistoryRequest,
  validateIdParam,
  validatePagination,
  validateUserRegister,
  validateUserLogin,
  validateApiKeyCreate,

  // 速率限制 (已禁用)
  createRateLimiter: () => (req, res, next) => next(),
  apiKeyRateLimiter,
  crawlRateLimiter,

  // 验证模式
  schemas: {
    crawlRequest: crawlRequestSchema,
    historyQuery: historyQuerySchema,
    idParam: idParamSchema,
    pagination: paginationSchema,
    userRegister: userRegisterSchema,
    userLogin: userLoginSchema,
    apiKey: apiKeySchema
  }
};