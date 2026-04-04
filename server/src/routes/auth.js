/**
 * 认证路由
 * 处理用户注册、登录和令牌管理
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const { validateUserRegister, validateUserLogin } = require('../middleware/validation');
const db = require('../db');

const router = express.Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', validateUserRegister, async (req, res) => {
  try {
    const { username, email, password } = req.validatedData;

    // 检查用户是否已存在
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'USER_EXISTS',
        message: '用户名已存在',
        timestamp: new Date().toISOString()
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_EXISTS',
        message: '邮箱已存在',
        timestamp: new Date().toISOString()
      });
    }

    // 密码哈希
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await db.createUser({
      username: username,
      email: email,
      password: hashedPassword
    });

    // 生成令牌
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email
    });

    res.status(201).json({
      success: true,
      code: 'REGISTER_SUCCESS',
      message: '用户注册成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        },
        token: token
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('用户注册失败:', error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '用户注册失败',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', validateUserLogin, async (req, res) => {
  try {
    const { username, password } = req.validatedData;

    // 获取用户
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
        timestamp: new Date().toISOString()
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: '用户名或密码错误',
        timestamp: new Date().toISOString()
      });
    }

    // 生成令牌
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email
    });

    res.json({
      success: true,
      code: 'LOGIN_SUCCESS',
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt
        },
        token: token
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('用户登录失败:', error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '用户登录失败',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 刷新令牌
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const oldToken = req.headers.authorization?.substring(7);
    if (!oldToken) {
      return res.status(401).json({
        success: false,
        code: 'NO_TOKEN',
        message: '未提供令牌',
        timestamp: new Date().toISOString()
      });
    }

    // 验证旧令牌
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(oldToken);

    // 生成新令牌
    const newToken = generateToken({
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email
    });

    res.json({
      success: true,
      code: 'TOKEN_REFRESHED',
      message: '令牌刷新成功',
      data: {
        token: newToken
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: '无效的令牌',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    // 使用可选认证中间件
    const { optionalAuthMiddleware } = require('../middleware/auth');
    await optionalAuthMiddleware(req, res, () => {});

    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: '未登录',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      code: 'SUCCESS',
      message: '获取用户信息成功',
      data: {
        user: req.user
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '获取用户信息失败',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;