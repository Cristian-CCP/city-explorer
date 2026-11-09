'use strict';

/**
 * Ciudades de ejemplo con las que arranca la API.
 * Se exporta una función para que cada instancia de la app
 * reciba una copia independiente (útil para las pruebas).
 */
const SEED_CITIES = [
  { name: 'Bogotá', country: 'Colombia', continent: 'América', population: 7907000 },
  { name: 'Medellín', country: 'Colombia', continent: 'América', population: 2612000 },
  { name: 'Ciudad de México', country: 'México', continent: 'América', population: 9209000 },
  { name: 'Buenos Aires', country: 'Argentina', continent: 'América', population: 3121000 },
  { name: 'Lima', country: 'Perú', continent: 'América', population: 10004000 },
  { name: 'Madrid', country: 'España', continent: 'Europa', population: 3332000 },
  { name: 'París', country: 'Francia', continent: 'Europa', population: 2103000 },
  { name: 'Tokio', country: 'Japón', continent: 'Asia', population: 13960000 },
  { name: 'Nairobi', country: 'Kenia', continent: 'África', population: 4397000 },
  { name: 'Sídney', country: 'Australia', continent: 'Oceanía', population: 5312000 }
];

function getSeedCities() {
  return SEED_CITIES.map((city, index) => ({ id: index + 1, ...city }));
}

module.exports = { getSeedCities };
