# UNS MQTT Live — broker + taller de sensores

App Node desplegable que levanta un **broker MQTT real** ([Aedes](https://github.com/moscajs/aedes))
para la **Sesión 11** (MQTT, Sparkplug, UNS). Sirve como “HiveMQ del salón”: cada grupo
conecta sus propios sensores desde su equipo, los datos se guardan en base de datos y se
ven en vivo. Incluye además una planta simulada como demostración.

## Páginas

| Ruta | Qué es |
|---|---|
| `/` | Demo: planta simulada (UNS en vivo, Sparkplug) — solo lectura |
| `/taller.html` | Monitor en vivo: grupos y dispositivos conectados + lecturas guardadas |
| `/comenzar.html` | Guía de conexión con los scripts ya rellenados (Python / Node) |

## Cómo conecta un estudiante

Por **MQTT sobre WebSocket** (Railway solo expone HTTPS):

- Broker: `wss://<app>.up.railway.app/mqtt`
- Usuario: el **grupo** (`grupo1`, …) · Contraseña: el **token del taller**
- Tópicos: `taller/<grupo>/<dispositivo>/<métrica>` (cada grupo solo publica bajo su nombre)

Scripts listos en [`workshop/`](workshop/): `sensor.py` (paho-mqtt) y `sensor.js` (mqtt.js),
más la [guía del estudiante](workshop/GUIA-ESTUDIANTE.md). La página `/comenzar.html` los
muestra ya rellenados con la URL real.

## Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `PORT` | Puerto HTTP (lo inyecta Railway) | la pone Railway |
| `WORKSHOP_TOKEN` | Contraseña única del taller para **publicar** | recomendada |
| `DATABASE_URL` | Postgres para **guardar** las lecturas | recomendada |
| `MQTT_TCP_PORT` | Puerto MQTT TCP (solo local / herramientas) | no |

Sin `WORKSHOP_TOKEN` el broker publica abierto. Sin `DATABASE_URL` guarda **en memoria**
(se pierde al reiniciar) para que todo funcione igual mientras configuras la base.

## Desplegar en Railway

1. **New Project → Deploy from GitHub repo** → este repo.
2. **+ New → Database → Add PostgreSQL** en el mismo proyecto.
3. En el servicio de la app, **Variables**:
   - `DATABASE_URL` → referencia la del Postgres (`${{Postgres.DATABASE_URL}}`).
   - `WORKSHOP_TOKEN` → inventa una contraseña para el salón (p. ej. `yogurt-2026`).
4. **Settings → Networking → Generate Domain**.
5. Comparte con los grupos: la URL, el token y el nombre de grupo de cada uno.

> ESP32 / dispositivos solo-TCP: necesitan el **TCP Proxy** de Railway (opcional, más adelante).
> Para laptops con Python/Node, WebSocket es suficiente.

## API (para el dashboard de la próxima clase)

| Endpoint | Devuelve |
|---|---|
| `GET /api/health` | estado del broker |
| `GET /api/stats` | totales (lecturas, grupos, dispositivos, almacenamiento) |
| `GET /api/groups` | grupos con conteo y última actividad |
| `GET /api/readings?grupo=&dispositivo=&limit=` | últimas lecturas |

## Correr en local

```bash
npm install
# sin base de datos (memoria) y sin token:
npm start
# con token y Postgres local:
WORKSHOP_TOKEN=demo DATABASE_URL=postgres://user:pass@localhost:5432/taller npm start
# abre http://localhost:8080
```

## Pila

Node + Express · Aedes (broker) · websocket-stream (MQTT/WS) · pg (Postgres) · mqtt.js (clientes, por CDN).

> ⚠ Broker abierto/sin TLS mutuo: material didáctico. En planta real, el broker del UNS es
> infraestructura crítica (auth, TLS, ACLs, alta disponibilidad).
