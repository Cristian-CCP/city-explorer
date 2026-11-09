'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

describe('City Explorer API', () => {
  let app;

  beforeEach(() => {
    // Cada prueba arranca con los datos de ejemplo originales
    app = createApp();
  });

  describe('GET /health', () => {
    it('responde 200 con status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('city-explorer-backend');
    });
  });

  describe('GET /api/cities', () => {
    it('lista las 10 ciudades de ejemplo', async () => {
      const res = await request(app).get('/api/cities');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(10);
      expect(res.body.data).toHaveLength(10);
      expect(res.body.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          country: expect.any(String),
          continent: expect.any(String),
          population: expect.any(Number)
        })
      );
    });

    it('filtra por nombre con ?q= sin importar tildes ni mayúsculas', async () => {
      const res = await request(app).get('/api/cities').query({ q: 'BOGOTA' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Bogotá');
    });

    it('filtra por país y continente', async () => {
      const byCountry = await request(app).get('/api/cities').query({ q: 'colombia' });
      const byContinent = await request(app).get('/api/cities').query({ q: 'europa' });

      expect(byCountry.body.count).toBe(2);
      expect(byContinent.body.count).toBe(2);
    });

    it('devuelve lista vacía si no hay coincidencias', async () => {
      const res = await request(app).get('/api/cities').query({ q: 'atlantida' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 0, data: [] });
    });
  });

  describe('POST /api/cities', () => {
    it('crea una ciudad válida y la incluye en el listado', async () => {
      const newCity = { name: 'Cali', country: 'Colombia', continent: 'América', population: 2228000 };

      const res = await request(app).post('/api/cities').send(newCity);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ id: 11, ...newCity });

      const list = await request(app).get('/api/cities');
      expect(list.body.count).toBe(11);
    });

    it('rechaza una ciudad inválida con 400 y detalle de errores', async () => {
      const res = await request(app)
        .post('/api/cities')
        .send({ name: 'X', population: -5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Datos inválidos');
      expect(res.body.details.length).toBeGreaterThanOrEqual(3);

      const list = await request(app).get('/api/cities');
      expect(list.body.count).toBe(10);
    });

    it('rechaza ciudades duplicadas con 409', async () => {
      const res = await request(app)
        .post('/api/cities')
        .send({ name: 'bogota', country: 'COLOMBIA', population: 1 });

      expect(res.status).toBe(409);
    });

    it('responde 400 cuando el JSON está mal formado', async () => {
      const res = await request(app)
        .post('/api/cities')
        .set('Content-Type', 'application/json')
        .send('{"name": "Cali",');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('JSON mal formado');
    });
  });

  describe('CORS y rutas desconocidas', () => {
    it('incluye cabeceras CORS', async () => {
      const res = await request(app).get('/api/cities').set('Origin', 'http://example.com');

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('responde 404 en JSON para rutas inexistentes', async () => {
      const res = await request(app).get('/api/no-existe');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ruta no encontrada');
    });
  });
});
