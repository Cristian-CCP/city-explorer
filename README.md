# 🌎 City Explorer

Aplicación web contenerizada para consultar, filtrar y registrar ciudades del mundo. Diseñada bajo una arquitectura de dos contenedores comunicados sobre una red Docker aislada (`ci-network`), con pipelines de integración continua configurados para **Jenkins**, **Travis CI** y **GitHub Actions**.

---

## 1. Arquitectura

- **Backend (`city-explorer-backend`)**: API REST en Node.js 20 + Express (puerto `3000`). Utiliza un repositorio indexado en memoria con búsqueda normalizada precomputada (`O(1)` por token) y detección de duplicados mediante `Set`.
- **Frontend (`city-explorer-frontend`)**: Interfaz vanilla HTML/CSS/JS servida por `nginx-unprivileged` (puerto `8080`) con caché en cliente, renderizado por lotes (`DocumentFragment`) y reverse proxy hacia `http://backend:3000` mediante DNS interno de Docker (`127.0.0.11`).

```
Navegador ──GET /api/cities──► frontend:8080 (Nginx) ──GET http://backend:3000/api/cities──► backend:3000
          ◄────── JSON ───────                       ◄──────────────── JSON ────────────────
```

### Endpoints principales

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| `GET` | `/health` | Estado operativo del servicio | `200 {"status":"ok", ...}` |
| `GET` | `/api/cities` | Lista ciudades (soporta `?q=`, `?limit=`, `?offset=`) | `200 {"count":n,"total":t,"data":[...]}` |
| `POST` | `/api/cities` | Registra una ciudad (`name`, `country`, `continent`, `population`) | `201`, `400`, `409` |

### Estructura del proyecto

```
.
├── backend/
│   ├── src/
│   │   ├── config/index.js               # Configuración centralizada por variables de entorno
│   │   ├── data/cities.js                # Semilla inicial de ciudades
│   │   ├── repositories/cityRepository.js# Repositorio indexado y paginación
│   │   ├── app.js                        # Aplicación Express y validaciones
│   │   └── server.js                     # Servidor HTTP con apagado ordenado (SIGTERM)
│   ├── tests/app.test.js                 # Suite de pruebas Jest + Supertest
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/app.js
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
├── Jenkinsfile
├── .travis.yml
├── .github/workflows/ci.yml
└── README.md
```

---

## 2. Ejecución rápida

### Levantar el entorno con Docker Compose

```bash
docker compose up --build -d
```

| Servicio | URL |
|---|---|
| Aplicación Web (Nginx) | http://localhost:8080 |
| API vía Reverse Proxy | http://localhost:8080/api/cities |
| Healthcheck vía Proxy | http://localhost:8080/health |
| Healthcheck directo Backend | http://localhost:3000/health |

Variables opcionales de puerto y CORS al desplegar:

```bash
FRONTEND_PORT=8080 BACKEND_PORT=3000 CORS_ORIGIN=* docker compose up --build -d
```

### Ejecutar pruebas automatizadas

```bash
cd backend
npm ci
npm test
```

---

## 3. Verificación del despliegue

```bash
# Estado de contenedores y healthchecks
docker compose ps

# Inspección de la red bridge aislada
docker network inspect ci-network

# Resolución DNS interna desde el contenedor frontend hacia backend
docker compose exec frontend wget -qO- http://backend:3000/health

# Consultas a la API a través del proxy Nginx
curl -s http://localhost:8080/health
curl -s "http://localhost:8080/api/cities?q=colombia"
curl -s "http://localhost:8080/api/cities?limit=3&offset=0"
```
