// Sensor del taller — publica a tu broker MQTT (sobre WebSocket / wss).
// Requisito:  npm init -y && npm install mqtt
// Ejecuta:    node sensor.js
//
// Edita HOST, GRUPO, DISPO y TOKEN con los datos que te dio el docente
// (o cópialos ya rellenos desde la página /comenzar de la app).

const mqtt = require("mqtt");

const HOST  = "TU-APP.up.railway.app"; // dominio de la app en Railway (sin https:// ni /mqtt)
const GRUPO = "grupo1";                // <-- el nombre de tu grupo (será tu usuario)
const DISPO = "sensor1";               // <-- el nombre de tu dispositivo
const TOKEN = "PON-AQUI-EL-TOKEN";     // token del taller (tu contraseña)

const c = mqtt.connect(`wss://${HOST}/mqtt`, {
  username: GRUPO,
  password: TOKEN,
  clientId: `${GRUPO}-${DISPO}`,
});

c.on("connect", () => {
  console.log("conectado, publicando...");
  setInterval(() => {
    const base = `taller/${GRUPO}/${DISPO}`;
    const t = Date.now();
    const temp = +(20 + Math.random() * 8).toFixed(2); // cambia por tu dato real
    const hum = +(50 + Math.random() * 20).toFixed(1);
    c.publish(`${base}/temperatura`, JSON.stringify({ v: temp, u: "C", t }));
    c.publish(`${base}/humedad`, JSON.stringify({ v: hum, u: "%", t }));
    console.log("->", base, "temp", temp, "hum", hum);
  }, 2000);
});

c.on("error", (e) => console.error("error:", e.message));
