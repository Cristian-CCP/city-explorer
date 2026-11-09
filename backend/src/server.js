'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[city-explorer-backend] escuchando en http://${HOST}:${PORT}`);
});

// Apagado ordenado: Docker envía SIGTERM al hacer "docker compose down/stop".
function shutdown(signal) {
  console.log(`[city-explorer-backend] ${signal} recibido, cerrando servidor...`);
  server.close(() => {
    console.log('[city-explorer-backend] servidor cerrado');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
