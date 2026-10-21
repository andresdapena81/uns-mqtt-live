# UNS MQTT Live — broker MQTT real para demostración

App Node desplegable que levanta un **broker MQTT real** ([Aedes](https://github.com/moscajs/aedes)),
simula los sensores de la **Línea 2 de Lácteos La Pradera** publicando a tópicos **UNS**
(jerarquía ISA-95) y sirve un **dashboard** donde el broker —no el navegador— enruta los
mensajes por comodines. Pensada para la **Sesión 11** (MQTT, Sparkplug, UNS).

A diferencia del demo estático, aquí el navegador habla **MQTT sobre WebSocket** contra un
broker de verdad, y puedes conectar otros clientes (MQTT Explorer, `mosquitto_sub` sobre WS)
al mismo broker.

## Qué incluye

- **Broker Aedes** sobre WebSocket en `ws(s)://<host>/mqtt` (un solo puerto → Railway-friendly).
- **Sensores simulados**: temperatura, pH, presión, volumen, conteo y OEE, como mensajes **retenidos**.
- **Sparkplug**: cada máquina publica su `.../status` (online/offline) y se cae/recupera sola.
- **Dashboard**: bus en vivo del UNS, suscripción propia con comodines, publicación manual y estado de dispositivos.

## Correr en local

```bash
npm install
npm start
# abre http://localhost:8080
# (opcional) MQTT por TCP para herramientas de escritorio:
#   MQTT_TCP_PORT=1883 npm start
```

## Desplegar en Railway

1. Sube esta carpeta a un repositorio de GitHub (o usa `railway up` con la CLI).
2. En [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** y elige el repo/carpeta.
3. Railway detecta Node por `package.json` (o usa el `Dockerfile`). No hay que configurar nada:
   la app escucha en `process.env.PORT` automáticamente.
4. Genera el dominio público (**Settings → Networking → Generate Domain**).
5. Abre `https://<tu-app>.up.railway.app`. El dashboard se conecta solo por `wss://…/mqtt`.

### Conectar otro cliente MQTT (WebSocket)

- URL: `wss://<tu-app>.up.railway.app/mqtt`
- Sin usuario/clave (broker abierto, solo para demostración).
- Suscríbete a `lacteos/#` para ver todo el UNS.

> ⚠ Broker **abierto y sin TLS mutuo**: es material didáctico. En planta real, el broker del UNS
> es infraestructura crítica (autenticación, TLS, ACLs, alta disponibilidad).

## Jerarquía de tópicos (UNS · ISA-95)

```
lacteos/bello/envasado/linea2/<máquina>/<métrica>
        └ sitio └ área  └ línea └ equipo  └ dato

lacteos/bello/envasado/linea2/fermentador/temperatura   → {"v":42.1,"u":"°C","t":...}
lacteos/bello/envasado/linea2/dosificadora/conteo       → {"v":4821,"u":"uds","t":...}
lacteos/bello/envasado/linea2/pasteurizador/status      → online | offline   (retenido)
lacteos/bello/envasado/linea2/oee                       → {"v":70.2,"u":"%","t":...}
```

## Pila

Node + Express (estáticos) · Aedes (broker) · websocket-stream (MQTT sobre WS) · mqtt.js (cliente del navegador, por CDN).
