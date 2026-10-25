// Persistencia de lecturas del taller.
//   - Si hay DATABASE_URL  → PostgreSQL (Railway).
//   - Si no                → respaldo en memoria (se pierde al reiniciar).
// API uniforme para que el resto de la app no sepa cuál está activo.

const DATABASE_URL = process.env.DATABASE_URL || "";
let pool = null;
let mode = "memoria";
const mem = []; // respaldo en memoria: [{ts, grupo, dispositivo, metrica, topico, valor, payload}]
const MEM_MAX = 5000;

async function init() {
  if (!DATABASE_URL) {
    console.log("[db] sin DATABASE_URL → almacenamiento EN MEMORIA (no persistente)");
    return;
  }
  const { Pool } = require("pg");
  // La red privada de Railway (*.railway.internal) y localhost NO usan SSL;
  // los endpoints públicos/proxy sí. Elegir SSL según el host evita fallos de conexión.
  const sinSsl = /localhost|127\.0\.0\.1|\.railway\.internal/.test(DATABASE_URL);
  const ssl = sinSsl ? false : { rejectUnauthorized: false };
  pool = new Pool({ connectionString: DATABASE_URL, ssl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS readings (
      id          BIGSERIAL PRIMARY KEY,
      ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
      grupo       TEXT,
      dispositivo TEXT,
      metrica     TEXT,
      topico      TEXT NOT NULL,
      valor       DOUBLE PRECISION,
      payload     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_readings_grupo_ts ON readings (grupo, ts DESC);
  `);
  mode = "postgres";
  console.log("[db] conectado a PostgreSQL → almacenamiento PERSISTENTE");
}

async function save(r) {
  if (mode === "postgres") {
    try {
      await pool.query(
        "INSERT INTO readings (grupo, dispositivo, metrica, topico, valor, payload) VALUES ($1,$2,$3,$4,$5,$6)",
        [r.grupo, r.dispositivo, r.metrica, r.topico, r.valor, r.payload]
      );
    } catch (e) {
      console.error("[db] error al guardar:", e.message);
    }
  } else {
    mem.push({ ts: new Date(), ...r });
    if (mem.length > MEM_MAX) mem.shift();
  }
}

async function stats() {
  if (mode === "postgres") {
    const a = await pool.query("SELECT COUNT(*)::int AS n FROM readings");
    const g = await pool.query("SELECT COUNT(DISTINCT grupo)::int AS n FROM readings");
    const d = await pool.query("SELECT COUNT(DISTINCT (grupo||'/'||dispositivo))::int AS n FROM readings");
    return { almacenamiento: mode, lecturas: a.rows[0].n, grupos: g.rows[0].n, dispositivos: d.rows[0].n };
  }
  const grupos = new Set(mem.map((m) => m.grupo));
  const devs = new Set(mem.map((m) => m.grupo + "/" + m.dispositivo));
  return { almacenamiento: mode, lecturas: mem.length, grupos: grupos.size, dispositivos: devs.size };
}

async function groups() {
  if (mode === "postgres") {
    const q = await pool.query(`
      SELECT grupo,
             COUNT(*)::int AS lecturas,
             COUNT(DISTINCT dispositivo)::int AS dispositivos,
             MAX(ts) AS ultimo
      FROM readings WHERE grupo IS NOT NULL
      GROUP BY grupo ORDER BY ultimo DESC`);
    return q.rows;
  }
  const by = {};
  for (const m of mem) {
    const k = m.grupo || "?";
    (by[k] = by[k] || { grupo: k, lecturas: 0, devs: new Set(), ultimo: m.ts }).lecturas++;
    by[k].devs.add(m.dispositivo);
    if (m.ts > by[k].ultimo) by[k].ultimo = m.ts;
  }
  return Object.values(by)
    .map((x) => ({ grupo: x.grupo, lecturas: x.lecturas, dispositivos: x.devs.size, ultimo: x.ultimo }))
    .sort((a, b) => b.ultimo - a.ultimo);
}

async function readings({ grupo, dispositivo, limit = 100 } = {}) {
  limit = Math.min(1000, Math.max(1, +limit || 100));
  if (mode === "postgres") {
    const where = [], vals = [];
    if (grupo) { vals.push(grupo); where.push(`grupo = $${vals.length}`); }
    if (dispositivo) { vals.push(dispositivo); where.push(`dispositivo = $${vals.length}`); }
    vals.push(limit);
    const q = await pool.query(
      `SELECT ts, grupo, dispositivo, metrica, topico, valor, payload FROM readings
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY ts DESC LIMIT $${vals.length}`, vals);
    return q.rows;
  }
  return mem
    .filter((m) => (!grupo || m.grupo === grupo) && (!dispositivo || m.dispositivo === dispositivo))
    .slice(-limit).reverse();
}

module.exports = { init, save, stats, groups, readings, get mode() { return mode; } };
