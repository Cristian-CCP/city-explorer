'use strict';

const { initialCities } = require('../data/cities');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildKey(name, country) {
  return `${normalize(name)}|${normalize(country)}`;
}

function buildSearchToken(city) {
  return `${normalize(city.name)} ${normalize(city.country)} ${normalize(city.continent)}`;
}

class CityRepository {
  constructor(seed = initialCities) {
    this.entries = [];
    this.uniqueKeys = new Set();
    this.nextId = 1;

    for (const item of seed) {
      this._insert({ ...item });
    }
  }

  _insert(record) {
    const id = record.id || this.nextId;
    if (id >= this.nextId) {
      this.nextId = id + 1;
    }

    const dto = Object.freeze({
      id,
      name: record.name,
      country: record.country,
      continent: record.continent,
      population: record.population
    });

    this.entries.push({
      dto,
      searchToken: buildSearchToken(dto)
    });
    this.uniqueKeys.add(buildKey(dto.name, dto.country));
    return dto;
  }

  hasDuplicate(name, country) {
    return this.uniqueKeys.has(buildKey(name, country));
  }

  findAll({ query = '', limit, offset = 0 } = {}) {
    const normalizedQuery = normalize(query);
    let results;

    if (!normalizedQuery) {
      results = this.entries.map((entry) => entry.dto);
    } else {
      results = [];
      for (let i = 0; i < this.entries.length; i += 1) {
        const entry = this.entries[i];
        if (entry.searchToken.includes(normalizedQuery)) {
          results.push(entry.dto);
        }
      }
    }

    const total = results.length;
    const start = Math.max(0, Number(offset) || 0);
    const parsedLimit = Number(limit);
    const data = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? results.slice(start, start + parsedLimit)
      : (start > 0 ? results.slice(start) : results);

    return { count: data.length, total, data };
  }

  create({ name, country, continent, population }) {
    return this._insert({ name, country, continent, population });
  }
}

function createCityRepository(seed) {
  return new CityRepository(seed);
}

module.exports = {
  CityRepository,
  createCityRepository,
  normalize
};
