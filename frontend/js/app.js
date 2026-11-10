(function () {
  'use strict';

  const API_BASE = '/api';
  const HEALTH_URL = '/health';
  const SEARCH_DEBOUNCE_MS = 220;
  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  const els = {
    apiStatus: document.getElementById('api-status'),
    apiStatusText: document.querySelector('#api-status .api-status__text'),
    count: document.getElementById('city-count'),
    search: document.getElementById('search-input'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    retry: document.getElementById('retry-btn'),
    empty: document.getElementById('empty'),
    list: document.getElementById('city-list'),
    form: document.getElementById('city-form'),
    submit: document.getElementById('submit-btn'),
    formMessage: document.getElementById('form-message')
  };

  const numberFormat = new Intl.NumberFormat('es-CO');
  const queryCache = new Map();
  let currentController = null;
  let debounceTimer = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  async function parseJsonSafe(response) {
    try {
      return await response.json();
    } catch (_e) {
      return null;
    }
  }

  function setState(state, message) {
    els.loading.hidden = state !== 'loading';
    els.error.hidden = state !== 'error';
    els.empty.hidden = state !== 'empty';
    els.list.hidden = state !== 'ready';
    if (state === 'error') {
      els.errorMessage.textContent = message || 'Error desconocido.';
    }
  }

  function setApiStatus(ok) {
    els.apiStatus.classList.toggle('api-status--ok', ok);
    els.apiStatus.classList.toggle('api-status--down', !ok);
    els.apiStatusText.textContent = ok ? 'API en línea' : 'API sin conexión';
  }

  function setFormMessage(text, type) {
    els.formMessage.textContent = text;
    els.formMessage.className = 'form__message' + (type ? ' form__message--' + type : '');
  }

  function renderCities(cities) {
    els.count.textContent = String(cities.length);
    els.list.textContent = '';

    if (cities.length === 0) {
      setState('empty');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < cities.length; i += 1) {
      const city = cities[i];
      const item = document.createElement('li');
      item.className = 'city-card';
      item.innerHTML =
        '<h3 class="city-card__name">' + escapeHtml(city.name) + '</h3>' +
        '<p class="city-card__country">' + escapeHtml(city.country) + '</p>' +
        '<div class="city-card__meta">' +
        '<span class="city-card__continent">' + escapeHtml(city.continent) + '</span>' +
        '<span class="city-card__population" title="Población">👥 ' +
        numberFormat.format(city.population) +
        '</span>' +
        '</div>';
      fragment.appendChild(item);
    }

    els.list.appendChild(fragment);
    setState('ready');
  }

  async function checkHealth() {
    try {
      const res = await fetch(HEALTH_URL, { headers: { Accept: 'application/json' } });
      setApiStatus(res.ok);
    } catch (_e) {
      setApiStatus(false);
    }
  }

  async function loadCities(query, forceRefresh = false) {
    const cacheKey = String(query || '').trim().toLowerCase();

    if (!forceRefresh && queryCache.has(cacheKey)) {
      renderCities(queryCache.get(cacheKey));
      return;
    }

    if (currentController) {
      currentController.abort();
    }
    currentController = new AbortController();

    setState('loading');
    const url = API_BASE + '/cities' + (cacheKey ? '?q=' + encodeURIComponent(query) : '');

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: currentController.signal
      });
      const body = await parseJsonSafe(res);

      if (!res.ok || !body || !Array.isArray(body.data)) {
        throw new Error('El servidor respondió con estado ' + res.status + '.');
      }

      setApiStatus(true);
      queryCache.set(cacheKey, body.data);
      renderCities(body.data);
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      setApiStatus(false);
      els.count.textContent = '0';
      setState('error', err.message || 'Revisa que el contenedor del backend esté en ejecución.');
    }
  }

  async function createCity(payload) {
    const res = await fetch(API_BASE + '/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await parseJsonSafe(res);

    if (!res.ok) {
      const details = body && Array.isArray(body.details) ? ' ' + body.details.join(' ') : '';
      const error = (body && body.error) || 'Error ' + res.status;
      throw new Error(error + '.' + details);
    }
    return body.data;
  }

  els.search.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      loadCities(els.search.value.trim());
    }, SEARCH_DEBOUNCE_MS);
  });

  els.retry.addEventListener('click', function () {
    checkHealth();
    loadCities(els.search.value.trim(), true);
  });

  els.form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setFormMessage('', null);

    const formData = new FormData(els.form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      country: String(formData.get('country') || '').trim(),
      continent: String(formData.get('continent') || '').trim(),
      population: Number(formData.get('population'))
    };

    if (payload.name.length < 2 || payload.country.length < 2) {
      setFormMessage('Nombre y país deben tener al menos 2 caracteres.', 'error');
      return;
    }
    if (formData.get('population') === '' || !Number.isInteger(payload.population) || payload.population <= 0) {
      setFormMessage('La población debe ser un número entero mayor a 0.', 'error');
      return;
    }

    els.submit.disabled = true;
    els.submit.textContent = 'Guardando…';

    try {
      const city = await createCity(payload);
      queryCache.clear();
      setFormMessage('✔ ' + city.name + ' se agregó correctamente.', 'success');
      els.form.reset();
      await loadCities(els.search.value.trim(), true);
    } catch (err) {
      setFormMessage(err.message, 'error');
    } finally {
      els.submit.disabled = false;
      els.submit.textContent = 'Agregar ciudad';
    }
  });

  Promise.all([checkHealth(), loadCities('')]);
})();
