/**
 * 爬虫执行器：仅负责拉起 Python 进程并解析输出。
 * 从 index.js 拆出，避免与 Express、队列形成循环依赖。
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[;&|`$(){}<>]/g, '');
}

function sanitizeUserAgent(ua) {
  if (typeof ua !== 'string') return '';
  return ua.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 512);
}

/** @param {unknown} n @param {number} lo @param {number} hi @param {number} fallback */
function clampInt(n, lo, hi, fallback) {
  const x = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}

/** @param {unknown} n @param {number} lo @param {number} hi @param {number} fallback */
function clampFloat(n, lo, hi, fallback) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}

/**
 * 来自前端的运行时参数（与模板 anti_crawl 映射一致）
 * @param {Record<string, unknown> | null | undefined} raw
 */
function normalizeCrawlRuntime(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const out = {};
  const mc = clampInt(o.maxConcurrent, 1, 20, NaN);
  if (Number.isFinite(mc)) out.maxConcurrent = mc;
  const rd = clampFloat(o.requestDelay, 0, 60, NaN);
  if (Number.isFinite(rd)) out.requestDelay = rd;
  const to = clampInt(o.timeout, 5, 120, NaN);
  if (Number.isFinite(to)) out.timeout = to;
  const mr = clampInt(o.maxRetries, 0, 15, NaN);
  if (Number.isFinite(mr)) out.maxRetries = mr;
  if (typeof o.userAgent === 'string' && o.userAgent.trim()) {
    out.userAgent = sanitizeUserAgent(o.userAgent.trim());
  }
  return Object.keys(out).length ? out : null;
}

const ASYNC_CRAWLER_SCRIPT_PATH = path.join(__dirname, '../../../src/scripts/crawler/async_crawler_manager.py');
const CRAWLER_SCRIPT_DIR = path.dirname(ASYNC_CRAWLER_SCRIPT_PATH);
const REPO_ROOT = path.join(__dirname, '../../..');

/**
 * 按优先级查找可用的 Python 解释器：venv > python3 > python
 */
function findPython() {
  const venvUnix = path.join(REPO_ROOT, 'venv/bin/python3');
  const venvWin = path.join(REPO_ROOT, 'venv/Scripts/python.exe');
  if (fs.existsSync(venvUnix)) return venvUnix;
  if (fs.existsSync(venvWin)) return venvWin;

  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch { /* 不可用 */ }
  }
  console.warn(
    '[crawlRunner] 未检测到项目 venv，使用系统 python3。若报 ModuleNotFoundError，请在仓库根目录执行: python3 -m venv venv && ./venv/bin/pip install -r requirements.txt'
  );
  return 'python3';
}

/**
 * @param {string} crawlerType
 * @param {string} url
 * @param {number} depth
 * @param {{ onProgress?: (progress: number, currentUrl: string) => void, crawlRuntime?: Record<string, unknown> | null }} [options]
 * @returns {Promise<Object>}
 */
function runCrawler(crawlerType, url, depth, options = {}) {
  const { onProgress, crawlRuntime: rawRuntime } = options;
  const rt = normalizeCrawlRuntime(rawRuntime) || {};
  return new Promise((resolve, reject) => {
    try {
      const sanitizedType = sanitizeInput(crawlerType);
      const sanitizedUrl = sanitizeInput(url);
      const sanitizedDepth = sanitizeInput(String(depth));

      const pythonPath = findPython();
      const maxConcurrent = rt.maxConcurrent != null ? String(rt.maxConcurrent) : '5';
      const requestDelay = rt.requestDelay != null ? String(rt.requestDelay) : '0.5';
      const args = [
        ASYNC_CRAWLER_SCRIPT_PATH,
        '--type', sanitizedType,
        '--url', sanitizedUrl,
        '--depth', sanitizedDepth,
        '--json',
        '--max-concurrent', maxConcurrent,
        '--request-delay', requestDelay
      ];
      if (rt.timeout != null) {
        args.push('--timeout', String(clampInt(rt.timeout, 5, 120, 10)));
      }
      if (rt.maxRetries != null) {
        args.push('--max-retries', String(clampInt(rt.maxRetries, 0, 15, 3)));
      }
      if (rt.userAgent) {
        args.push('--user-agent', String(rt.userAgent).slice(0, 512));
      }
      console.log('执行爬虫命令:', pythonPath, args);

      const pyPathEnv = [CRAWLER_SCRIPT_DIR, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
      const pythonProcess = spawn(pythonPath, args, {
        cwd: CRAWLER_SCRIPT_DIR,
        env: { ...process.env, PYTHONPATH: pyPathEnv }
      });
      let output = '';
      let errorOutput = '';

      /** 队列执行时通过 WS 推送“进行中”进度（Python 本身不吐细粒度进度） */
      let progressTimer = null;
      if (typeof onProgress === 'function') {
        const startedAt = Date.now();
        const cap = 92;
        progressTimer = setInterval(() => {
          const elapsedSec = (Date.now() - startedAt) / 1000;
          // 先快后慢逼近 cap，避免长时间线性“假进度”与用户直觉不符
          const pct = Math.min(cap, Math.round(96 * (1 - Math.exp(-elapsedSec / 34))));
          onProgress(pct, sanitizedUrl);
        }, 650);
      }

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const clearProgress = () => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      };

      pythonProcess.on('close', (code) => {
        clearProgress();
        console.log('爬虫进程结束，退出码:', code);

        const baseResult = {
          url: sanitizedUrl,
          type: sanitizedType,
          depth: parseInt(sanitizedDepth, 10) || 2,
          items: 0,
          time: 0,
          data: [],
          error: null,
          partialOutput: output.substring(0, 1000)
        };

        if (code !== 0) {
          console.error('爬虫执行失败，错误输出:', errorOutput);
          baseResult.error = `爬虫执行失败，退出码: ${code}\n错误信息: ${errorOutput.substring(0, 500)}`;
          resolve(baseResult);
          return;
        }

        try {
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}');

          if (jsonStart === -1 || jsonEnd === -1) {
            baseResult.error = 'Python脚本输出格式错误，无法解析JSON';
            resolve(baseResult);
            return;
          }

          const jsonString = output.substring(jsonStart, jsonEnd + 1);
          const parsedResult = JSON.parse(jsonString);

          /** async_crawler_manager 输出为 { success, data: { items, time, type, data, ... }, error }，需展平到顶层供前端展示 */
          const nested =
            parsedResult &&
            typeof parsedResult === 'object' &&
            parsedResult.data != null &&
            typeof parsedResult.data === 'object' &&
            !Array.isArray(parsedResult.data)
              ? parsedResult.data
              : {};

          const managerErr =
            parsedResult && parsedResult.success === false && parsedResult.error
              ? String(parsedResult.error)
              : null;

          const depthNum = parseInt(sanitizedDepth, 10) || 2;
          const payloadData = nested.data != null ? nested.data : nested.links || [];

          const finalResult = {
            ...baseResult,
            ...nested,
            url: sanitizedUrl,
            type: nested.type || sanitizedType,
            depth: Number.isFinite(nested.depth) ? nested.depth : depthNum,
            data: Array.isArray(payloadData) ? payloadData : [],
            error: managerErr || nested.error || baseResult.error
          };

          resolve(finalResult);
        } catch (error) {
          console.error('解析爬虫结果失败:', error);
          baseResult.error = `解析爬虫结果失败: ${error.message}`;
          resolve(baseResult);
        }
      });

      pythonProcess.on('error', (error) => {
        clearProgress();
        console.error('启动爬虫进程失败:', error);
        reject(new Error(`启动爬虫进程失败: ${error.message}`));
      });
    } catch (error) {
      console.error('执行爬虫脚本失败:', error.message);
      reject(new Error(`执行爬虫脚本失败: ${error.message}`));
    }
  });
}

module.exports = { runCrawler, sanitizeInput, normalizeCrawlRuntime };
