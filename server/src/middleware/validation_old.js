/**
 * 输入验证中间件
 * 提高API安全性
 */

const validateCrawlRequest = (req, res, next) => {
  try {
    const { type, url, depth } = req.body;

    // 验证必需参数
    if (!type) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '缺少必要参数: type',
        timestamp: new Date().toISOString()
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '缺少必要参数: url',
        timestamp: new Date().toISOString()
      });
    }

    // 验证爬虫类型
    const validTypes = ['link', 'content', 'image'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CRAWLER_TYPE',
        message: `不支持的爬虫类型: ${type}`,
        details: { validTypes },
        timestamp: new Date().toISOString()
      });
    }

    // 验证URL格式
    try {
      const urlObj = new URL(url);
      if (!urlObj.protocol || !urlObj.hostname) {
        throw new Error('Invalid URL format');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_URL',
        message: 'URL格式无效',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // 验证深度
    if (depth !== undefined) {
      const depthNum = Number(depth);
      if (isNaN(depthNum) || depthNum < 1 || depthNum > 10) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DEPTH',
          message: 'depth必须在1-10之间',
          details: { depth },
          timestamp: new Date().toISOString()
        });
      }
    }

    // 验证通过
    next();
  } catch (error) {
    next(error);
  }
};

const validateHistoryRequest = (req, res, next) => {
  try {
    const { limit } = req.query;

    if (limit !== undefined) {
      const limitNum = Number(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LIMIT',
          message: 'limit必须在1-100之间',
          details: { limit },
          timestamp: new Date().toISOString()
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

const validateIdParam = (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ID',
        message: '无效的ID参数',
        details: { id },
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateCrawlRequest,
  validateHistoryRequest,
  validateIdParam
};