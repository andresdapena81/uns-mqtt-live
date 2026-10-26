// Planta del profesor — "Lácteos La Pradera" modelada en ISA-95 completa.
// Se conecta al broker como el grupo "profesor" y publica, en vivo y retenido,
// toda la jerarquía empresa→sitio→área→línea→máquina→métrica, con señales de
// gobierno (OEE, calidad, energía, estados). Pensada para alimentar un tablero
// de gobierno robusto. Corre dentro del servidor (siempre encendida).
//
// Tópico:  taller/profesor/<area>/<linea>/<maquina>/<metrica>
// Payload: {"v":valor,"u":unidad,"t":ms,"area","linea","maquina","metrica","tipo"}
//          tipo ∈ dato | kpi | estado

const mqtt = require("mqtt");

// ---------- generadores con estado ----------
const bounded = (v, amp, min, max) => {
  let cur = v;
  return () => { cur += (Math.random() - 0.5) * amp; cur = Math.max(min, Math.min(max, cur)); return +cur.toFixed(2); };
};
const noisy = (base, amp, dec = 2) => () => +(base + (Math.random() - 0.5) * amp).toFixed(dec);
const counter = (start, maxStep) => { let v = start; return () => { v += Math.floor(Math.random() * (maxStep + 1)); return v; }; };
const accum = (start, per) => { let v = start; return () => { v += per * (0.7 + Math.random() * 0.6); return +v.toFixed(2); }; };
// Día local de la planta (America/Bogota por defecto) en formato YYYY-MM-DD.
const TZ = process.env.PLANT_TZ || "America/Bogota";
const bogotaDay = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
// Contadores que se reinician a medianoche (hora de la planta): producción, rechazos, kWh "de hoy".
const dailyCounter = (maxStep, dayFn = bogotaDay) => { let v = 0, day = dayFn(); return () => { const d = dayFn(); if (d !== day) { day = d; v = 0; } v += Math.floor(Math.random() * (maxStep + 1)); return v; }; };
const dailyAccum = (per, dayFn = bogotaDay) => { let v = 0, day = dayFn(); return () => { const d = dayFn(); if (d !== day) { day = d; v = 0; } v += per * (0.7 + Math.random() * 0.6); return +v.toFixed(2); }; };
const konst = (x) => () => x;
const status = (pOff = 0.03) => { let s = "online"; return () => { if (s === "online" && Math.random() < pOff) s = "offline"; else if (s === "offline" && Math.random() < 0.6) s = "online"; return s; }; };
const door = () => { let s = "cerrada"; return () => { if (s === "cerrada" && Math.random() < 0.08) s = "abierta"; else if (s === "abierta" && Math.random() < 0.7) s = "cerrada"; return s; }; };
// OEE coherente por línea: oee = disponibilidad × rendimiento × calidad
function makeOEE() {
  let d = 0.92, r = 0.93, c = 0.975;
  const step = (x, a, lo, hi) => Math.max(lo, Math.min(hi, x + (Math.random() - 0.5) * a));
  return {
    disp: () => { d = step(d, 0.03, 0.78, 0.98); return +d.toFixed(3); },
    rend: () => { r = step(r, 0.03, 0.80, 0.99); return +r.toFixed(3); },
    cal: () => { c = step(c, 0.015, 0.90, 0.999); return +c.toFixed(3); },
    oee: () => +(d * r * c).toFixed(3),
  };
}

// ---------- modelo ISA-95 ----------
const EMPRESA = "lacteos", SITIO = "bello";
const SIGNALS = []; // {area, linea, maquina, metrica, u, tipo, gen}
function sig(area, linea, maquina, metrica, u, tipo, gen) {
  SIGNALS.push({ area, linea, maquina, metrica, u, tipo, gen });
}

// -- Área: recepción --
sig("recepcion", "recepcion", "tanque_tq01", "nivel", "%", "dato", bounded(68, 4, 20, 98));
sig("recepcion", "recepcion", "tanque_tq01", "temperatura", "C", "dato", bounded(4.2, 0.5, 2, 7));
sig("recepcion", "recepcion", "tanque_tq01", "estado", "", "estado", status());
sig("recepcion", "recepcion", "bomba_bo01", "caudal", "L/min", "dato", bounded(420, 40, 0, 600));
sig("recepcion", "recepcion", "bomba_bo01", "presion", "bar", "dato", bounded(2.4, 0.2, 1, 4));
sig("recepcion", "recepcion", "bomba_bo01", "estado", "", "estado", status());
sig("recepcion", "recepcion", "analizador_qa01", "grasa", "%", "dato", bounded(3.4, 0.2, 2.5, 4.2));
sig("recepcion", "recepcion", "analizador_qa01", "densidad", "g/cm3", "dato", noisy(1.031, 0.004, 3));
sig("recepcion", "recepcion", "analizador_qa01", "antibioticos", "ppb", "dato", bounded(2, 2, 0, 12));

// -- Área: pasteurización --
sig("pasteurizacion", "pasteurizacion", "pasteurizador_pz01", "temperatura", "C", "dato", bounded(72, 1.5, 60, 78));
sig("pasteurizacion", "pasteurizacion", "pasteurizador_pz01", "temperatura_sp", "C", "dato", konst(72));
sig("pasteurizacion", "pasteurizacion", "pasteurizador_pz01", "presion", "bar", "dato", bounded(1.2, 0.1, 0.6, 2));
sig("pasteurizacion", "pasteurizacion", "pasteurizador_pz01", "caudal", "L/min", "dato", bounded(380, 30, 0, 500));
sig("pasteurizacion", "pasteurizacion", "pasteurizador_pz01", "estado", "", "estado", status());
sig("pasteurizacion", "pasteurizacion", "intercambiador_ic01", "temp_entrada", "C", "dato", bounded(6, 1, 3, 12));
sig("pasteurizacion", "pasteurizacion", "intercambiador_ic01", "temp_salida", "C", "dato", bounded(72, 1.5, 60, 78));

// -- Área: fermentación --
for (const ft of ["ft01", "ft02"]) {
  sig("fermentacion", "fermentacion", "fermentador_" + ft, "temperatura", "C", "dato", bounded(42, 0.6, 38, 45));
  sig("fermentacion", "fermentacion", "fermentador_" + ft, "ph", "", "dato", bounded(4.6, 0.08, 4.2, 6.6));
  sig("fermentacion", "fermentacion", "fermentador_" + ft, "tiempo", "h", "dato", bounded(3, 0.2, 0, 8));
  sig("fermentacion", "fermentacion", "fermentador_" + ft, "estado", "", "estado", status());
}
sig("fermentacion", "fermentacion", "dosificador_dc01", "dosis", "mL", "dato", bounded(50, 5, 40, 60));
sig("fermentacion", "fermentacion", "dosificador_dc01", "estado", "", "estado", status());

// -- Área: envasado (2 líneas) --
for (const linea of ["linea1", "linea2"]) {
  sig("envasado", linea, "dosificadora_ds05", "volumen", "mL", "dato", bounded(150, 2, 140, 160));
  sig("envasado", linea, "dosificadora_ds05", "conteo", "uds", "dato", dailyCounter(6));   // producción de hoy
  sig("envasado", linea, "dosificadora_ds05", "estado", "", "estado", status());
  sig("envasado", linea, "tapadora_tp03", "torque", "Nm", "dato", bounded(1.8, 0.2, 1, 3));
  sig("envasado", linea, "tapadora_tp03", "rechazos", "uds", "dato", dailyCounter(1));      // rechazos de hoy
  sig("envasado", linea, "tapadora_tp03", "estado", "", "estado", status());
  sig("envasado", linea, "etiquetadora_et02", "conteo", "uds", "dato", dailyCounter(6));
  sig("envasado", linea, "etiquetadora_et02", "rechazos", "uds", "dato", dailyCounter(1));
  // KPIs de gobierno a nivel de línea (coherentes: oee = d·r·c)
  const k = makeOEE();
  sig("envasado", linea, "kpi", "disponibilidad", "", "kpi", k.disp);
  sig("envasado", linea, "kpi", "rendimiento", "", "kpi", k.rend);
  sig("envasado", linea, "kpi", "calidad", "", "kpi", k.cal);
  sig("envasado", linea, "kpi", "oee", "", "kpi", k.oee);
  sig("envasado", linea, "kpi", "paradas", "min", "kpi", dailyCounter(1));
}

// -- Área: frío / almacén --
sig("frio", "frio", "camara_cf01", "temperatura", "C", "dato", bounded(4, 0.6, 1, 9));
sig("frio", "frio", "camara_cf01", "humedad", "%", "dato", bounded(78, 4, 60, 95));
sig("frio", "frio", "camara_cf01", "puerta", "", "estado", door());
sig("frio", "frio", "camara_cf01", "estado", "", "estado", status(0.02));
sig("frio", "frio", "compresor_cp01", "potencia", "kW", "dato", bounded(18, 3, 0, 30));
sig("frio", "frio", "compresor_cp01", "estado", "", "estado", status());

// -- Área: energía / utilidades --
sig("energia", "utilidades", "medidor_em01", "potencia", "kW", "dato", bounded(145, 20, 60, 260));
sig("energia", "utilidades", "medidor_em01", "energia", "kWh", "kpi", dailyAccum(0.2));   // kWh de hoy
sig("energia", "utilidades", "medidor_em01", "factor_potencia", "", "dato", bounded(0.94, 0.03, 0.82, 0.99));
sig("energia", "utilidades", "caldera_cl01", "presion_vapor", "bar", "dato", bounded(8, 0.6, 5, 11));
sig("energia", "utilidades", "caldera_cl01", "temperatura", "C", "dato", bounded(165, 6, 120, 190));
sig("energia", "utilidades", "caldera_cl01", "estado", "", "estado", status());
sig("energia", "utilidades", "agua_wm01", "caudal", "m3/h", "dato", bounded(6, 1.2, 0, 12));
sig("energia", "utilidades", "agua_wm01", "consumo", "m3", "kpi", accum(3400, 0.01));

// ---------- publicador ----------
function start(opts = {}) {
  const port = opts.port || process.env.PORT || 8080;
  const token = opts.token != null ? opts.token : (process.env.WORKSHOP_TOKEN || "");
  const period = Number(process.env.PLANT_PERIOD_MS || 5000);
  const url = `ws://127.0.0.1:${port}/mqtt`;

  const client = mqtt.connect(url, {
    username: "profesor",
    password: token,
    clientId: "profesor-plant",
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    console.log(`[plant] profesor conectado · ${SIGNALS.length} señales ISA-95 cada ${period} ms`);
    publishAll(); // primer envío inmediato (retenido)
    setInterval(publishAll, period);
  });
  client.on("error", (e) => console.error("[plant] error:", e.message));

  function publishAll() {
    const t = Date.now();
    for (const s of SIGNALS) {
      const v = s.gen();
      const topic = `taller/profesor/${s.area}/${s.linea}/${s.maquina}/${s.metrica}`;
      const payload = JSON.stringify({
        v, u: s.u, t,
        empresa: EMPRESA, sitio: SITIO,
        area: s.area, linea: s.linea, maquina: s.maquina, metrica: s.metrica, tipo: s.tipo,
      });
      client.publish(topic, payload, { qos: 0, retain: true });
    }
  }
  return { signals: SIGNALS.length };
}

module.exports = { start, SIGNALS };
