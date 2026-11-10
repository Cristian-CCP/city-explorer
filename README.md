# 🌎 City Explorer

Proyecto del curso de **Integración Continua**. Es una aplicación para consultar, filtrar y agregar ciudades, dividida en **2 contenedores Docker** que se comunican por una red bridge propia. También deja listos los pipelines de **Jenkins**, **Travis CI** y **GitHub Actions** para las entregas 2 y 3.

| Entrega | Alcance | Archivos clave |
|---|---|---|
| 1 | Docker: 2 contenedores comunicados | `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml` |
| 2 | Pipeline en Jenkins | `Jenkinsfile` |
| 3 | Travis CI + documentación de problemas | `.travis.yml`, `.github/workflows/ci.yml`, sección [Problemas y soluciones](#7-problemas-y-soluciones) |

---

## 1. Descripción y arquitectura

- **Backend** (`city-explorer-backend`): API REST hecha con Node.js 20 y Express, en el puerto **3000**. Guarda los datos en memoria y arranca con 10 ciudades de ejemplo. Tiene CORS configurado.
- **Frontend** (`city-explorer-frontend`): HTML, CSS y JavaScript sin frameworks, servido por **Nginx** en el puerto **8080**. Nginx también actúa como **reverse proxy**: todo lo que llega a `/api/*` (y a `/health`) lo reenvía al backend usando el **nombre del servicio** `backend`.


### API

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| GET | `/health` | Estado del servicio | `200 {"status":"ok", ...}` |
| GET | `/api/cities` | Lista todas las ciudades | `200 {"count":10,"data":[...]}` |
| GET | `/api/cities?q=texto` | Filtra por ciudad, país o continente (ignora tildes y mayúsculas) | `200 {"count":n,"data":[...]}` |
| POST | `/api/cities` | Crea una ciudad. Body: `{"name","country","continent"?,"population"}` | `201`, `400` (inválida), `409` (duplicada) |

### Estructura

```
.
├── backend/
│   ├── src/
│   │   ├── app.js            # App Express (rutas, validación, CORS)
│   │   ├── server.js         # Arranque HTTP + apagado ordenado (SIGTERM)
│   │   └── data/cities.js    # 10 ciudades de ejemplo
│   ├── tests/app.test.js     # Jest + Supertest (11 pruebas)
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
├── .gitignore
└── README.md
```

---

## 2. Requisitos y cómo ejecutar

### Requisitos

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| Docker Engine / Docker Desktop | 24+ | Construir y correr los contenedores |
| Docker Compose (plugin v2) | 2.20+ | `docker compose up` |
| Node.js *(opcional)* | 20 | Correr las pruebas fuera de Docker |
| Git | 2.x | Control de versiones |

### Ejecutar todo (un solo comando)

```bash
docker compose up --build
```

Para correrlo en segundo plano:

```bash
docker compose up --build -d
```

| URL | Qué muestra |
|---|---|
| http://localhost:8080 | Interfaz web (frontend) |
| http://localhost:8080/api/cities | API a través del proxy de Nginx |
| http://localhost:8080/health | Health del backend a través del proxy |
| http://localhost:3000/health | Health del backend directo (verificación) |

Para detener:

```bash
docker compose down
```

### Pruebas del backend (sin Docker)

```bash
cd backend
npm ci
npm test
```

### Pruebas del backend (dentro de Docker)

```bash
docker build --target test ./backend
```

---

## 3. Explicación de los Dockerfiles y del docker-compose

### 3.1 `backend/Dockerfile` (multi-stage, 4 etapas)

| Etapa | Imagen base | Qué hace |
|---|---|---|
| `deps-dev` | `node:20-alpine` | Copia `package.json` y `package-lock.json` y corre `npm ci` con **todas** las dependencias (incluye Jest). |
| `test` | `deps-dev` | Copia `src/` y `tests/` y corre `npm test`. **Solo se construye si se pide** con `--target test`, así que no frena `docker compose up`. |
| `deps-prod` | `node:20-alpine` | `npm ci --omit=dev`: instala solo `express` y `cors` y limpia la caché de npm. |
| `runtime` | `node:20-alpine` | Imagen final: copia `node_modules` de producción y `src/`. **No incluye Jest, Supertest ni las pruebas.** |

Buenas prácticas aplicadas:
- **Usuario no root**: `USER node` (uid 1000, ya viene en la imagen oficial) y los archivos se copian con `--chown=node:node`.
- **Caché de capas**: los manifiestos de npm se copian antes que el código, así que si solo cambia `src/`, la instalación no se repite.
- `NODE_ENV=production`, `EXPOSE 3000`, `HEALTHCHECK` con `wget` (viene en Alpine/BusyBox).
- `CMD ["node", "src/server.js"]` en forma *exec*: Node es el PID 1 y recibe `SIGTERM`. `server.js` cierra el servidor de forma ordenada.
- `.dockerignore` deja fuera `node_modules`, `coverage`, `.env` y `.git` del contexto de build.

### 3.2 `frontend/Dockerfile` (multi-stage, 2 etapas)

| Etapa | Imagen base | Qué hace |
|---|---|---|
| `build` | `alpine:3.20` | Copia `index.html`, `css/` y `js/`, revisa que existan, los deja en `/dist` y ajusta permisos (644/755). |
| `runtime` | `nginxinc/nginx-unprivileged:1.27-alpine` | Copia `nginx.conf` como `default.conf` y los estáticos desde `build`. |

- **Usuario no root**: la imagen `nginx-unprivileged` corre como el usuario `nginx` (uid 101). Por eso escucha en **8080**: un usuario sin privilegios no puede usar puertos menores a 1024.
- `HEALTHCHECK` contra `/nginx-health`, una ruta que responde Nginx directamente sin depender del backend.

### 3.3 `docker-compose.yml`

| Clave | Valor | Para qué |
|---|---|---|
| `name` | `city-explorer` | Nombre fijo del proyecto (prefijo de los recursos). |
| `build.target` | `runtime` | Construye solo la etapa final de cada Dockerfile. |
| `image` | `city-explorer-backend:latest` / `city-explorer-frontend:latest` | Nombres de imagen predecibles para CI. |
| `networks` | `ci-network` (driver `bridge`, `name: ci-network`) | Red propia y aislada. Su DNS interno resuelve `backend` y `frontend`. |
| `healthcheck` (backend) | `wget http://127.0.0.1:3000/health` cada 10 s, 5 reintentos | Marca el contenedor como `healthy` solo cuando la API responde. |
| `depends_on.backend.condition` | `service_healthy` | El frontend **espera** a que el backend esté sano antes de arrancar. |
| `restart` | `unless-stopped` | Si un contenedor se cae, Docker lo reinicia (a menos que lo detengas a mano). |
| `ports` | `8080:8080`, `3000:3000` | 8080 es la entrada de usuario. 3000 se publica solo para verificar desde el host. |
| `environment` | `NODE_ENV`, `PORT`, `CORS_ORIGIN` | Configuración del backend sin tocar el código. |

---

## 4. Cómo se comunican los contenedores

1. **Red bridge propia**: los dos servicios están en `ci-network`. Docker les da a los contenedores de una red definida por el usuario un **DNS interno** (`127.0.0.11`) que resuelve cada **nombre de servicio** a la IP del contenedor.
2. **Nombre de servicio en lugar de IP o localhost**: dentro del contenedor del frontend, `localhost` es el propio contenedor de Nginx, no el backend. Por eso Nginx usa `http://backend:3000`.
3. **Proxy de Nginx** (`frontend/nginx.conf`):
   ```nginx
   resolver 127.0.0.11 valid=10s ipv6=off;      # DNS interno de Docker
   set $backend_upstream http://backend:3000;   # nombre del servicio

   location /api/ {
       proxy_pass $backend_upstream;            # /api/cities -> http://backend:3000/api/cities
   }
   location = /health {
       proxy_pass $backend_upstream;            # /health -> http://backend:3000/health
   }
   ```
   Como se usa una variable junto con `resolver`, Nginx vuelve a resolver `backend` cada 10 s. Si el backend se reinicia y cambia de IP, el proxy sigue funcionando.
4. **Navegador**: `js/app.js` solo usa **rutas relativas** (`fetch('/api/cities')`). El navegador le habla únicamente a Nginx (mismo origen, sin problemas de CORS) y Nginx reenvía la petición al backend por la red interna. El frontend **nunca** usa `localhost:3000`.

```
Navegador ──GET /api/cities──► frontend:8080 (nginx) ──GET http://backend:3000/api/cities──► backend:3000
          ◄────── JSON ───────                       ◄──────────────── JSON ────────────────
```

---

## 5. Comandos de verificación

```bash
# 1. Estado de los contenedores (ambos deben mostrar "Up ... (healthy)")
docker compose ps

# 2. Inspeccionar la red: deben aparecer los 2 contenedores con sus IPs
docker network inspect ci-network

# Solo nombres e IPs:
docker network inspect ci-network \
  --format '{{range .Containers}}{{.Name}} -> {{.IPv4Address}}{{"\n"}}{{end}}'

# 3. Logs
docker compose logs
docker compose logs -f backend
docker compose logs --tail=50 frontend

# 4. Health del backend (directo y a través del proxy de Nginx)
curl -s http://localhost:3000/health
curl -s http://localhost:8080/health

# 5. Listar y filtrar ciudades a través del frontend (proxy)
curl -s http://localhost:8080/api/cities
curl -s "http://localhost:8080/api/cities?q=colombia"

# 6. Crear una ciudad a través del proxy
curl -s -X POST http://localhost:8080/api/cities \
  -H "Content-Type: application/json" \
  -d '{"name":"Cali","country":"Colombia","continent":"América","population":2228000}'

# 7. Crear una ciudad inválida (debe responder 400)
curl -s -i -X POST http://localhost:8080/api/cities \
  -H "Content-Type: application/json" -d '{"name":"X"}'

# 8. Comunicación por nombre de servicio DESDE el contenedor frontend
docker compose exec frontend wget -qO- http://backend:3000/health

# 9. Comprobar que los contenedores NO corren como root
docker compose exec backend id     # uid=1000(node)
docker compose exec frontend id    # uid=101(nginx)

# 10. Tamaño de las imágenes
docker image ls | grep city-explorer
```

Respuestas esperadas:

```json
// GET /health
{"status":"ok","service":"city-explorer-backend","uptime":12,"timestamp":"..."}

// GET /api/cities?q=colombia
{"count":2,"data":[{"id":1,"name":"Bogotá","country":"Colombia","continent":"América","population":7907000},
                   {"id":2,"name":"Medellín","country":"Colombia","continent":"América","population":2612000}]}
```

