// UNS MQTT Live — broker MQTT real (Aedes) para el taller de la Sesión 11.
//
//   - MQTT sobre WebSocket en  ws(s)://<host>/mqtt   (navegador, Python/paho, Node/mqtt.js)
//   - MQTT sobre TCP en MQTT_TCP_PORT                 (opcional, uso local)
//   - Dashboard de demostración en   /
//   - Monitor del taller en          /taller         (quién está conectado, en vivo)
//   - Guía de conexión en            /comenzar
//   - API REST en                    /api/*
//
// Espacio de los estudiantes:   taller/<grupo>/<dispositivo>/<metrica>
// Espacio de la demostración:   lacteos/bello/envasado/linea2/...  (sensores simulados)
//
// Seguridad (opcional): si WORKSHOP_TOKEN está definido, para PUBLICAR en taller/
// hay que conectarse con username=<grupo> y password=<WORKSHOP_TOKEN>, y cada grupo
// solo puede publicar bajo su propio prefijo. Suscribirse (leer) es abierto.

const http = require("http");
const path = require("path");
const express = require("express");
const aedes = require("aedes")();
const ws = require("websocket-stream");
const db = require("./db");

const TOKEN = process.env.WORKSHOP_TOKEN || "";
const TALLER = "taller/";

// -------- App HTTP --------
const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, broker: "aedes", clientes: Object.keys(aedes.clients).length, uptime_s: Math.round(process.uptime()) })
);
app.get("/api/stats", async (_req, res) => {
  const s = await db.stats();
  res.json({ ...s, clientes_conectados: Object.keys(aedes.clients).length, token_requerido: !!TOKEN });
});
app.get("/api/groups", async (_req, res) => res.json(await db.groups()));
app.get("/api/readings", async (req, res) => res.json(await db.readings(req.query)));

const server = http.createServer(app);

// MQTT sobre WebSocket en la misma conexión HTTP (Railway expone un solo puerto).
ws.createServer({ server, path: "/mqtt" }, aedes.handle);

// MQTT sobre TCP (opcional, solo si se define MQTT_TCP_PORT).
if (process.env.MQTT_TCP_PORT) {
  require("net").createServer(aedes.handle).listen(Number(process.env.MQTT_TCP_PORT), () =>
    console.log("[mqtt] TCP en", process.env.MQTT_TCP_PORT));
}

// -------- Autenticación y autorización --------
aedes.authenticate = (client, username, password, cb) => {
  client.grupo = (username || "").toString().trim().toLowerCase();
  const pass = password ? password.toString() : "";
  client.authed = TOKEN ? pass === TOKEN : true;
  cb(null, true); // conectar/suscribir es abierto; el control está en authorizePublish
};
aedes.authorizePublish = (client, packet, cb) => {
  const t = packet.topic || "";
  if (!t.startsWith(TALLER)) return cb(new Error("solo se permite publicar en taller/<grupo>/..."));
  if (TOKEN && !client.authed) return cb(new Error("token del taller inválido"));
  const grupoTopico = t.split("/")[1];
  if (client.grupo && grupoTopico && grupoTopico !== client.grupo)
    return cb(new Error(`tu grupo es '${client.grupo}'; no puedes publicar en '${grupoTopico}'`));
  cb(null);
};

// -------- Persistencia del espacio del taller --------
aedes.on("publish", (packet, client) => {
  const t = packet.topic || "";
  if (!client || !t.startsWith(TALLER)) return; // solo mensajes de clientes en taller/
  const parts = t.split("/"); // taller / grupo / dispositivo / metrica...
  const payload = packet.payload ? packet.payload.toString() : "";
  let valor = null;
  try { const o = JSON.parse(payload); valor = typeof o === "object" && o && "v" in o ? +o.v : (isFinite(+payload) ? +payload : null); }
  catch (_) { valor = isFinite(+payload) ? +payload : null; }
  db.save({
    grupo: parts[1] || null,
    dispositivo: parts[2] || null,
    metrica: parts.slice(3).join("/") || null,
    topico: t,
    valor,
    payload,
  });
});

aedes.on("client", (c) => console.log("[broker] conectado:", c.id, c.grupo ? "(grupo " + c.grupo + ")" : ""));
aedes.on("clientDisconnect", (c) => console.log("[broker] desconectado:", c.id));

// -------- Sensores simulados de demostración (espacio lacteos/...) --------
const BASE = "lacteos/bello/envasado/linea2";
function pub(topic, payload, retain = true) {
  aedes.publish({ topic, payload: Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)), qos: 0, retain });
}
function noisy(base, amp, d) { return () => +(base + (Math.random() - 0.5) * amp * 2).toFixed(d); }
let conteo = 4820;
const METRICS = [
  { topic: `${BASE}/pasteurizador/temperatura`, unit: "°C", gen: noisy(72, 1.2, 1) },
  { topic: `${BASE}/pasteurizador/presion`, unit: "bar", gen: noisy(1.2, 0.05, 2) },
  { topic: `${BASE}/fermentador/temperatura`, unit: "°C", gen: noisy(42, 0.5, 1) },
  { topic: `${BASE}/fermentador/ph`, unit: "", gen: noisy(4.5, 0.08, 2) },
  { topic: `${BASE}/dosificadora/volumen`, unit: "ml", gen: noisy(150, 0.5, 1) },
  { topic: `${BASE}/oee`, unit: "%", gen: noisy(70, 1.5, 1) },
];
const DEVICES = ["pasteurizador", "fermentador", "dosificadora"];
const deviceState = Object.fromEntries(DEVICES.map((d) => [d, "online"]));
const publishStatus = (d) => pub(`${BASE}/${d}/status`, deviceState[d], true);
DEVICES.forEach(publishStatus);
setInterval(() => {
  for (const m of METRICS) {
    const dev = m.topic.split("/")[4];
    if (DEVICES.includes(dev) && deviceState[dev] === "offline") continue;
    pub(m.topic, { v: m.gen(), u: m.unit, t: Date.now() }, true);
  }
  if (deviceState.dosificadora === "online") { if (Math.random() < 0.8) conteo++; pub(`${BASE}/dosificadora/conteo`, { v: conteo, u: "uds", t: Date.now() }, true); }
}, 1500);
function tumbar(dev) {
  if (deviceState[dev] !== "online") return;
  deviceState[dev] = "offline"; publishStatus(dev); console.log("[sparkplug]", dev, "→ offline");
  setTimeout(() => { deviceState[dev] = "online"; publishStatus(dev); console.log("[sparkplug]", dev, "→ online"); }, 5000 + Math.random() * 4000);
}
setInterval(() => {
  const online = DEVICES.filter((d) => deviceState[d] === "online");
  if (online.length < DEVICES.length) return;
  if (Math.random() < 0.5) tumbar(online[Math.floor(Math.random() * online.length)]);
}, 8000);

// -------- Arranque --------
const PORT = process.env.PORT || 8080;
db.init().catch((e) => console.error("[db] init:", e.message)).finally(() => {
  server.listen(PORT, () => {
    console.log(`[http] en :${PORT}  · WS MQTT: /mqtt  · token ${TOKEN ? "REQUERIDO" : "no requerido"}`);
  });
});
