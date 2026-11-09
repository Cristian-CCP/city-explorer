'use strict';

const express = require('express');
const cors = require('cors');
const { getSeedCities } = require('./data/cities');

/**
 * Normaliza texto para búsquedas: minúsculas y sin tildes.
 * "Bogotá" -> "bogota"
 */
function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Valida el cuerpo de POST /api/cities.
 * Devuelve un arreglo de mensajes de error (vacío si es válido).
 */
function validateCity(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['El cuerpo de la petición debe ser un objeto JSON.'];
  }

  const { name, country, continent, population } = body;

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    errors.push('"name" es obligatorio y debe tener entre 2 y 80 caracteres.');
  }
  if (typeof country !== 'string' || country.trim().length < 2 || country.trim().length > 80) {
    errors.push('"country" es obligatorio y debe tener entre 2 y 80 caracteres.');
  }
  if (continent !== undefined && (typeof continent !== 'string' || continent.trim().length > 40)) {
    errors.push('"continent" debe ser texto de máximo 40 caracteres.');
  }
  if (!Number.isInteger(population) || population < 0) {
    errors.push('"population" es obligatorio y debe ser un entero mayor o igual a 0.');
  }

  return errors;
}

/**
 * Crea una instancia de la aplicación Express con su propio
 * almacenamiento en memoria.
 */
function createApp(options = {}) {
  const app = express();
  const cities = getSeedCities();
  let nextId = cities.length + 1;

  const corsOrigin = options.corsOrigin || process.env.CORS_ORIGIN || '*';
  const allowedOrigins = corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim());

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type']
    })
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'city-explorer-backend',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/cities', (req, res) => {
    const q = typeof req.query.q === 'string' ? normalize(req.query.q) : '';
    const result = q
      ? cities.filter((city) =>
          [city.name, city.country, city.continent].some((field) => normalize(field).includes(q))
        )
      : cities;

    res.status(200).json({ count: result.length, data: result });
  });

  app.post('/api/cities', (req, res) => {
    const errors = validateCity(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors });
    }

    const name = req.body.name.trim();
    const country = req.body.country.trim();
    const continent = (req.body.continent || 'Sin especificar').trim() || 'Sin especificar';

    const duplicated = cities.some(
      (city) => normalize(city.name) === normalize(name) && normalize(city.country) === normalize(country)
    );
    if (duplicated) {
      return res
        .status(409)
        .json({ error: 'Ciudad duplicada', details: [`${name} (${country}) ya existe.`] });
    }

    const city = { id: nextId++, name, country, continent, population: req.body.population };
    cities.push(city);
    return res.status(201).json({ data: city });
  });

  // Rutas inexistentes
  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
  });

  // Manejador de errores (por ejemplo, JSON mal formado)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON mal formado' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Cuerpo de la petición demasiado grande' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { createApp, normalize, validateCity };
