/**
 * 生产环境监听：固定端口、绑定 LISTEN_HOST（默认 0.0.0.0），不占位顺延、不写 .dev-backend-port。
 */

/**
 * @param {import('express').Express} app
 * @param {number} port
 * @param {string} [host='0.0.0.0']
 * @returns {Promise<{ server: import('http').Server; port: number }>}
 */
function listenProduction(app, port, host = '0.0.0.0') {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      resolve({ server, port });
    });
    server.once('error', reject);
  });
}

module.exports = { listenProduction };
