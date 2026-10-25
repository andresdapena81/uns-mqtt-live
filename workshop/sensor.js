// Sensor del taller — publica VARIOS sensores a tu broker MQTT (sobre WebSocket / wss).
// Requisito:  npm init -y && npm install mqtt
// Ejecuta:    node sensor.js
//
// TU TAREA: deja al menos 3 sensores DIFERENTES en la lista SENSORES
//           (cambia nombres, métricas, unidades y rangos por los de tu proyecto).

const mqtt = require("mqtt");

const HOST  = "TU-APP.up.railway.app"; // dominio de la app en Railway (sin https:// ni /mqtt)
const GRUPO = "grupo1";                // <-- el nombre de tu grupo (será tu usuario)
const TOKEN = "PON-AQUI-EL-TOKEN";     // token del taller (tu contraseña)

// >>> MÍNIMO 3 SENSORES DIFERENTES — edita esta lista <<<
const SENSORES = [
  { dispositivo: "tanque_leche",   metrica: "nivel",       unidad: "%",   min: 40,  max: 95 },
  { dispositivo: "banda_envasado", metrica: "velocidad",   unidad: "m/s", min: 0.2, max: 1.5 },
  { dispositivo: "camara_frio",    metrica: "temperatura", unidad: "C",   min: 2,   max: 8 },
];

const c = mqtt.connect(`wss://${HOST}/mqtt`, {
  username: GRUPO,
  password: TOKEN,
  clientId: `${GRUPO}-${Math.floor(1000 + Math.random() * 9000)}`,
});

c.on("connect", () => {
  console.log(`conectado como '${GRUPO}' con ${SENSORES.length} sensores.`);
  setInterval(() => {
    const t = Date.now();
    for (const s of SENSORES) {
      const valor = +(s.min + Math.random() * (s.max - s.min)).toFixed(2);
      const topico = `taller/${GRUPO}/${s.dispositivo}/${s.metrica}`;
      c.publish(topico, JSON.stringify({ v: valor, u: s.unidad, t }));
      console.log("->", topico, valor, s.unidad);
    }
    console.log("---");
  }, 2000);
});

c.on("error", (e) => console.error("error:", e.message));
