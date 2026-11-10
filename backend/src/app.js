'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { createCityRepository, normalize } = require('./repositories/cityRepository');

function validateCityPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['El cuerpo de la solicitud debe ser un objeto JSON válido.'] };
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const country = typeof payload.country === 'string' ? payload.country.trim() : '';
  const continent =
    typeof payload.continent === 'string' && payload.continent.trim().length > 0
      ? payload.continent.trim()
      : config.defaultContinent;

  if (name.length < 2 || name.length > 80) {
    errors.push('El campo "name" es obligatorio y debe tener entre 2 y 80 caracteres.');
  }

  if (country.length < 2 || country.length > 80) {
    errors.push('El campo "country" es obligatorio y debe tener entre 2 y 80 caracteres.');
  }

  const rawPop = payload.population;
  const population = typeof rawPop === 'number' ? rawPop : Number(rawPop);

  if (
    rawPop === undefined ||
    rawPop === null ||
    rawPop === '' ||
    !Number.isInteger(population) ||
    population <= 0 ||
    population > config.maxPopulation
  ) {
    errors.push(`El campo "population" debe ser un número entero positivo menor o igual a ${config.maxPopulation}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: { name, country, continent, population }
  };
}

function createApp(seedCities) {
  const app = express();
  const repository = createCityRepository(seedCities);

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept']
    })
  );
  app.use(express.json({ limit: config.jsonLimit }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'city-explorer-backend',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/cities', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const result = repository.findAll({
      query,
      limit: req.query.limit,
      offset: req.query.offset
    });

    res.status(200).json(result);
  });

  app.post('/api/cities', (req, res) => {
    const { valid, errors, sanitized } = validateCityPayload(req.body);

    if (!valid) {
      return res.status(400).json({
        error: 'Datos de ciudad inválidos.',
        details: errors
      });
    }

    if (repository.hasDuplicate(sanitized.name, sanitized.country)) {
      return res.status(409).json({
        error: `La ciudad "${sanitized.name}" en "${sanitized.country}" ya se encuentra registrada.`
      });
    }

    const newCity = repository.create(sanitized);
    return res.status(201).json({
      message: 'Ciudad agregada exitosamente.',
      data: newCity
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON mal formado.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Cuerpo de la solicitud demasiado grande.' });
    }
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}

const app = createApp();

module.exports = { app, createApp, normalize, validateCityPayload };
