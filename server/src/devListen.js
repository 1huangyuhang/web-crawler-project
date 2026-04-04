/**
 * 开发时端口占用自动顺延，并把实际端口写入仓库根目录 .dev-backend-port，
 * 供 Vite 代理按请求读取，避免 EADDRINUSE 导致整站 dev 挂掉。
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '../..');
const DEV_BACKEND_PORT_FILE = path.join(REPO_ROOT, '.dev-backend-port');

function clearDevBackendPortFile() {
  try {
    fs.unlinkSync(DEV_BACKEND_PORT_FILE);
  } catch {
    /* 不存在则忽略 */
  }
}

function writeDevBackendPortFile(port) {
  try {
    fs.writeFileSync(DEV_BACKEND_PORT_FILE, String(port), 'utf8');
  } catch (e) {
    console.warn('[dev] 无法写入 .dev-backend-port（Vite 代理可能仍指向 3001）:', e.message);
  }
}

/**
 * @param {import('express').Express} app
 * @param {number} basePort
 * @param {number} [maxAttempts=30]
 * @returns {Promise<{ server: import('http').Server; port: number }>}
 */
function listenFromBasePort(app, basePort, maxAttempts = 30) {
  clearDevBackendPortFile();

  return new Promise((resolve, reject) => {
    let offset = 0;

    function attemptListen() {
      if (offset >= maxAttempts) {
        reject(
          new Error(
            `端口 ${basePort}–${basePort + maxAttempts - 1} 均被占用，请关闭占用进程或设置 PORT 环境变量`
          )
        );
        return;
      }

      const tryPort = basePort + offset;
      offset += 1;

      const server = app.listen(tryPort);

      const onError = (err) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE') {
          attemptListen();
        } else {
          reject(err);
        }
      };

      const onListening = () => {
        server.removeListener('error', onError);
        if (tryPort !== basePort) {
          console.warn(
            `[端口] 首选端口 ${basePort} 已被占用（EADDRINUSE），已自动切换到 ${tryPort}。` +
              ' 运行 npm run dev 时 Vite 会等待 .dev-backend-port 并代理到该端口。'
          );
        }
        writeDevBackendPortFile(tryPort);
        resolve({ server, port: tryPort });
      };

      server.once('error', onError);
      server.once('listening', onListening);
    }

    attemptListen();
  });
}

module.exports = {
  listenFromBasePort,
  clearDevBackendPortFile,
  DEV_BACKEND_PORT_FILE
};
