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

```
                          HOST (tu máquina / agente CI)
   ┌──────────────────────────────────────────────────────────────────────┐
   │                                                                      │
   │   Navegador ──► http://localhost:8080                                │
   │                        │                                             │
   │        ┌───────────────┼──── red bridge: ci-network ─────────────┐   │
   │        │               ▼                                         │   │
   │        │  ┌───────────────────────────┐    ┌──────────────────┐  │   │
   │        │  │ frontend                  │    │ backend          │  │   │
   │        │  │ nginx-unprivileged:alpine │    │ node:20-alpine   │  │   │
   │        │  │ :8080                     │    │ :3000            │  │   │
   │        │  │                           │    │                  │  │   │
   │        │  │  /          → estáticos   │    │ GET  /health     │  │   │
   │        │  │  /api/*  ───┼─ proxy_pass ┼───►│ GET  /api/cities │  │   │
   │        │  │  /health ───┘ http://backend:3000  POST /api/cities │  │   │
   │        │  └───────────────────────────┘    └──────────────────┘  │   │
   │        │        ▲ depends_on: service_healthy ─────┘             │   │
   │        └─────────────────────────────────────────────────────────┘   │
   │                                                                      │
   │   Puertos publicados: 8080 → frontend | 3000 → backend (solo para    │
   │   verificar con curl / smoke test; el frontend NO lo usa)            │
   └──────────────────────────────────────────────────────────────────────┘
```

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

---

## 6. Evidencias

Pantallazos para el documento de entrega:

**Entrega 1 – Docker**
1. [ ] Árbol del proyecto en el editor (estructura de carpetas).
2. [ ] `backend/Dockerfile` y `frontend/Dockerfile` abiertos (etapas multi-stage).
3. [ ] `docker-compose.yml` mostrando red, healthcheck y `depends_on`.
4. [ ] Terminal con `docker compose up --build` terminado (ambos servicios arrancados).
5. [ ] `docker compose ps` con los 2 contenedores en estado `healthy`.
6. [ ] `docker network inspect ci-network` con los 2 contenedores y sus IPs.
7. [ ] `docker compose logs` mostrando el arranque del backend y los accesos de Nginx.
8. [ ] `curl http://localhost:3000/health` y `curl http://localhost:8080/health`.
9. [ ] `curl http://localhost:8080/api/cities` y `curl "http://localhost:8080/api/cities?q=colombia"`.
10. [ ] `docker compose exec frontend wget -qO- http://backend:3000/health` (comunicación por nombre de servicio).
11. [ ] `docker compose exec backend id` (usuario no root).
12. [ ] Navegador en http://localhost:8080 con la lista de ciudades.
13. [ ] Navegador con el buscador filtrando (por ejemplo, "europa").
14. [ ] Navegador después de agregar una ciudad (mensaje de éxito).
15. [ ] Estado de error: `docker compose stop backend`, recargar la página y tomar el pantallazo del mensaje de error con el botón "Reintentar".
16. [ ] `npm test` con las pruebas en verde.

**Entrega 2 – Jenkins**
17. [ ] Configuración del job (Pipeline from SCM).
18. [ ] Stage View con todos los stages en verde.
19. [ ] Console Output del stage *Smoke test*.

**Entrega 3 – Travis CI / GitHub Actions**
20. [ ] Build exitoso en Travis CI.
21. [ ] Workflow exitoso en GitHub Actions (jobs `test` y `docker`).
22. [ ] Historial de ramas y commits (`git log --oneline --graph --all`).

---

## 7. Problemas y soluciones

> Plantilla para documentar los problemas encontrados durante el proyecto (entrega 3). Copia el bloque por cada problema.

### Problema N.º 1

| Campo | Detalle |
|---|---|
| **Fecha** | |
| **Entrega / etapa** | (Docker / Jenkins / Travis / GitHub Actions) |
| **Descripción del problema** | |
| **Mensaje de error / evidencia** | |
| **Causa raíz** | |
| **Solución aplicada** | |
| **Cómo se verificó** | |
| **Lección aprendida** | |

### Problema N.º 2

| Campo | Detalle |
|---|---|
| **Fecha** | |
| **Entrega / etapa** | |
| **Descripción del problema** | |
| **Mensaje de error / evidencia** | |
| **Causa raíz** | |
| **Solución aplicada** | |
| **Cómo se verificó** | |
| **Lección aprendida** | |

---

## 8. Flujo de ramas sugerido

```
main      ●───────────────────────●──────────────────●   (versiones estables / entregas)
           \                     / merge             /
develop     ●──────●──────●─────●──────●──────●─────●     (integración continua)
                    \    /              \    /
feature/*            ●──●                ●──●             (una rama por funcionalidad)
```

| Rama | Propósito | Reglas |
|---|---|---|
| `main` | Código estable. Cada entrega se etiqueta (`v1.0.0`, `v2.0.0`, `v3.0.0`). | Solo recibe merges desde `develop` cuando el CI está en verde. |
| `develop` | Rama de integración. Aquí corren los pipelines en cada push. | Recibe merges/PR desde `feature/*`. |
| `feature/<nombre>` | Una funcionalidad o cambio puntual (por ejemplo, `feature/jenkins-pipeline`). | Sale de `develop` y vuelve a `develop` por Pull Request. |

Ejemplo de ciclo:

```bash
git checkout develop
git checkout -b feature/jenkins-pipeline
# ... cambios ...
git add .
git commit -m "ci(jenkins): add smoke test stage"
git push -u origin feature/jenkins-pipeline
# Pull Request feature/jenkins-pipeline -> develop (CI en verde)
# Al cerrar la entrega: PR develop -> main y tag
git checkout main && git merge --no-ff develop && git tag v1.0.0
```

**Commits semánticos** ([Conventional Commits](https://www.conventionalcommits.org/)): `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `build:`, `chore:`, `refactor:`.

---

## Anexo: configuración rápida de CI

### Jenkins (entrega 2)
1. Plugins: *Pipeline*, *Git*, *NodeJS*, *Docker Pipeline* (opcional).
2. *Manage Jenkins → Tools → NodeJS installations*: agrega una instalación llamada **`node-20`** (versión 20.x).
3. El usuario `jenkins` debe poder correr `docker` (`sudo usermod -aG docker jenkins` y reiniciar Jenkins).
4. Crea un job **Pipeline → Pipeline script from SCM**, apunta al repositorio y deja `Jenkinsfile` como script path.
5. Stages: `Checkout → Install → Test → Build Docker images → Deploy → Smoke test`.

> Si Jenkins corre **dentro de un contenedor**, `localhost` en el smoke test es el propio contenedor de Jenkins. En ese caso cambia `BACKEND_URL`/`FRONTEND_URL` en el `Jenkinsfile` a `http://host.docker.internal:3000` / `:8080`, o conecta Jenkins a la red `ci-network`.

### Travis CI (entrega 3)
1. Entra en https://app.travis-ci.com con tu cuenta de GitHub y activa el repositorio.
2. Cada push a `main`, `develop` o `feature/*` corre: `npm ci` → `npm test` → `docker build` de las 2 imágenes.

### GitHub Actions
Viene activado por defecto con `.github/workflows/ci.yml`: el job `test` (Node 20 + Jest) y luego el job `docker` (`docker compose build` + `up --wait` + smoke test con curl).
