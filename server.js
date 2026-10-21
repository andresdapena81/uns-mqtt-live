// UNS MQTT Live — broker MQTT real (Aedes) + sensores simulados + dashboard.
// Un solo proceso, un solo puerto (process.env.PORT). Pensado para Railway.
//
//   - MQTT sobre WebSocket en  ws(s)://<host>/mqtt   (navegador y clientes WS)
//   - MQTT sobre TCP en el puerto MQTT_TCP_PORT       (opcional, uso local)
//   - Dashboard estático en    /
//
// Los sensores de la "Línea 2 de Lácteos La Pradera" publican a tópicos UNS
// (jerarquía ISA-95) con mensajes retenidos; los dispositivos anuncian su
// estado online/offline (idea de Sparkplug BIRTH/DEATH + Last Will).

const http = require("http");
const path = require("path");
const express = require("express");
const aedes = require("aedes")();
const ws = require("websocket-stream");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Salud y metadatos (útil para Railway y para el dashboard).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    broker: "aedes",
    clients: Object.keys(aedes.clients).length,
    uptime_s: Math.round(process.uptime()),
  });
});

const server = http.createServer(app);

// MQTT sobre WebSocket, en la MISMA conexión HTTP (Railway expone un solo puerto).
ws.createServer({ server, path: "/mqtt" }, aedes.handle);

// MQTT sobre TCP (opcional): solo si se define MQTT_TCP_PORT (p. ej. en local).
if (process.env.MQTT_TCP_PORT) {
  const net = require("net");
  net.createServer(aedes.handle).listen(Number(process.env.MQTT_TCP_PORT), () =>
    console.log("[mqtt] TCP escuchando en", process.env.MQTT_TCP_PORT)
  );
}

// -------- Trazas del broker (van a los logs de Railway) --------
aedes.on("client", (c) => console.log("[broker] conectado:", c.id));
aedes.on("clientDisconnect", (c) => console.log("[broker] desconectado:", c.id));
aedes.on("subscribe", (subs, c) =>
  console.log("[broker] suscribe", c.id, "→", subs.map((s) => s.topic).join(", "))
);

// -------- Sensores simulados (UNS · ISA-95) --------
const BASE = "lacteos/bello/envasado/linea2";

function pub(topic, payload, retain = true) {
  aedes.publish({
    topic,
    payload: Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)),
    qos: 0,
    retain,
  });
}

// Valor con ruido alrededor de una base.
function noisy(base, amp, digits) {
  return () => +(base + (Math.random() - 0.5) * amp * 2).toFixed(digits);
}
let conteo = 4820;

const METRICS = [
  { topic: `${BASE}/pasteurizador/temperatura`, unit: "°C", gen: noisy(72, 1.2, 1) },
  { topic: `${BASE}/pasteurizador/presion`,     unit: "bar", gen: noisy(1.2, 0.05, 2) },
  { topic: `${BASE}/fermentador/temperatura`,   unit: "°C", gen: noisy(42, 0.5, 1) },
  { topic: `${BASE}/fermentador/ph`,            unit: "",   gen: noisy(4.5, 0.08, 2) },
  { topic: `${BASE}/dosificadora/volumen`,      unit: "ml", gen: noisy(150, 0.5, 1) },
  { topic: `${BASE}/oee`,                        unit: "%",  gen: noisy(70, 1.5, 1) },
];

const DEVICES = ["pasteurizador", "fermentador", "dosificadora"];
const deviceState = Object.fromEntries(DEVICES.map((d) => [d, "online"]));

function publishStatus(dev) {
  // Estado retenido: un suscriptor que llega tarde ve de inmediato el último estado.
  pub(`${BASE}/${dev}/status`, deviceState[dev], true);
}

// Estado inicial retenido.
DEVICES.forEach(publishStatus);

// Telemetría periódica.
setInterval(() => {
  for (const m of METRICS) {
    // Si la máquina de la métrica está offline, no publica (como en planta real).
    const dev = m.topic.split("/")[4];
    if (DEVICES.includes(dev) && deviceState[dev] === "offline") continue;
    pub(m.topic, { v: m.gen(), u: m.unit, t: Date.now() }, true);
  }
  // Conteo de la dosificadora (si está online).
  if (deviceState.dosificadora === "online") {
    if (Math.random() < 0.8) conteo++;
    pub(`${BASE}/dosificadora/conteo`, { v: conteo, u: "uds", t: Date.now() }, true);
  }
}, 1500);

// Cada tanto, UNA máquina "se cae" y vuelve sola — para ver Sparkplug/Last Will en vivo.
// Regla: a lo sumo una offline a la vez, y siempre se recupera (no se acumulan caídas).
function tumbar(dev) {
  if (deviceState[dev] !== "online") return;
  deviceState[dev] = "offline";
  publishStatus(dev);
  console.log("[sparkplug]", dev, "→ offline (DEATH)");
  setTimeout(() => {
    deviceState[dev] = "online";
    publishStatus(dev);
    console.log("[sparkplug]", dev, "→ online (BIRTH)");
  }, 5000 + Math.random() * 4000);
}
setInterval(() => {
  const online = DEVICES.filter((d) => deviceState[d] === "online");
  if (online.length < DEVICES.length) return; // ya hay una caída: espera a que vuelva
  if (Math.random() < 0.5) tumbar(online[Math.floor(Math.random() * online.length)]);
}, 8000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[http] dashboard + MQTT/WS escuchando en :${PORT}  (ruta WS: /mqtt)`);
});
