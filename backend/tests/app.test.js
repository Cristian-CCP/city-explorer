'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

describe('City Explorer Backend API', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    it('returns 200 and service health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'city-explorer-backend');
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.timestamp).toBe('string');
    });
  });

  describe('GET /api/cities', () => {
    it('lists the initial 10 cities', async () => {
      const response = await request(app).get('/api/cities');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count', 10);
      expect(response.body).toHaveProperty('total', 10);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.data[0]).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Bogotá',
          country: 'Colombia',
          continent: 'América'
        })
      );
    });

    it('filters cities by query ignoring accents and case', async () => {
      const byCountry = await request(app).get('/api/cities?q=colombia');
      expect(byCountry.status).toBe(200);
      expect(byCountry.body.count).toBe(2);
      expect(byCountry.body.data.map((c) => c.name)).toEqual(
        expect.arrayContaining(['Bogotá', 'Medellín'])
      );

      const byAccentlessName = await request(app).get('/api/cities?q=bogota');
      expect(byAccentlessName.status).toBe(200);
      expect(byAccentlessName.body.count).toBe(1);
      expect(byAccentlessName.body.data[0].name).toBe('Bogotá');

      const noMatches = await request(app).get('/api/cities?q=atlantis');
      expect(noMatches.status).toBe(200);
      expect(noMatches.body.count).toBe(0);
      expect(noMatches.body.data).toEqual([]);
    });

    it('supports limit and offset pagination for dataset scaling', async () => {
      const page = await request(app).get('/api/cities?limit=3&offset=2');

      expect(page.status).toBe(200);
      expect(page.body.count).toBe(3);
      expect(page.body.total).toBe(10);
      expect(page.body.data.map((c) => c.id)).toEqual([3, 4, 5]);
    });
  });

  describe('POST /api/cities', () => {
    it('creates a valid city and returns 201', async () => {
      const payload = {
        name: 'Cali',
        country: 'Colombia',
        continent: 'América',
        population: 2228000
      };

      const postRes = await request(app)
        .post('/api/cities')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(postRes.status).toBe(201);
      expect(postRes.body).toHaveProperty('data');
      expect(postRes.body.data).toEqual({
        id: 11,
        name: 'Cali',
        country: 'Colombia',
        continent: 'América',
        population: 2228000
      });

      const listRes = await request(app).get('/api/cities?q=cali');
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);
    });

    it('assigns default continent when omitted', async () => {
      const postRes = await request(app)
        .post('/api/cities')
        .send({ name: 'Quito', country: 'Ecuador', population: 2011000 });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.continent).toBe('Desconocido');
    });

    it('rejects invalid payloads with 400', async () => {
      const invalidRes = await request(app)
        .post('/api/cities')
        .send({ name: 'A', country: '', population: -50 });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body).toHaveProperty('error');
      expect(Array.isArray(invalidRes.body.details)).toBe(true);
      expect(invalidRes.body.details.length).toBeGreaterThanOrEqual(3);
    });

    it('rejects duplicate city and country with 409', async () => {
      const duplicateRes = await request(app)
        .post('/api/cities')
        .send({ name: 'bogota', country: 'COLOMBIA', population: 8000000 });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body).toHaveProperty('error');
    });

    it('rejects array or malformed JSON payloads with 400', async () => {
      const arrayRes = await request(app)
        .post('/api/cities')
        .send([{ name: 'Cali' }]);

      expect(arrayRes.status).toBe(400);
      expect(arrayRes.body.details).toContain('El cuerpo de la solicitud debe ser un objeto JSON válido.');

      const malformedRes = await request(app)
        .post('/api/cities')
        .set('Content-Type', 'application/json')
        .send('{"name": "Cali",');

      expect(malformedRes.status).toBe(400);
      expect(malformedRes.body.error).toBe('JSON mal formado.');
    });

    it('rejects empty population with 400', async () => {
      const res = await request(app)
        .post('/api/cities')
        .send({ name: 'Cartagena', country: 'Colombia', population: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('Unknown routes (404)', () => {
    it('returns 404 JSON on non-existent routes', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Recurso no encontrado.' });
    });
  });
});
