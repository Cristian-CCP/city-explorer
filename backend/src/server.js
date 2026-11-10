'use strict';

const { app } = require('./app');
const config = require('./config');

const server = app.listen(config.port, config.host, () => {
  console.log(`[city-explorer-backend] Listening on http://${config.host}:${config.port}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

function shutdown(signal) {
  console.log(`[city-explorer-backend] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
