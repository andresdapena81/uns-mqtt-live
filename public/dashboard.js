/* Dashboard: series en vivo (sparklines) por grupo/dispositivo/métrica + flujo de mensajes. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const URL = `${proto}://${location.host}/mqtt`;
  const COLORS = ["#C6FF00", "#27E5E5", "#FFB000", "#22E06B", "#9D6BFF", "#FF3B30"];

  const MAXPTS = 40;
  const groups = {};          // grupo -> { devices: { dispositivo: { metrics: { metrica: {vals, unit, last, ts, color, canvas} } } } }
  const seen = {};            // grupo -> última actividad
  let colorIx = 0;
  let msgTimes = [];          // timestamps para msg/s

  function colorFor(key) { return COLORS[(colorIx++) % COLORS.length]; }

  function ingest(topic, payloadStr) {
    const p = topic.split("/");
    if (p.length < 4) return;
    const [, g, d] = p;
    const metrica = p.slice(3).join("/");
    let v = null, unit = "";
    try { const o = JSON.parse(payloadStr); if (o && typeof o === "object") { v = +o.v; unit = o.u || ""; } }
    catch (_) { v = +payloadStr; }
    if (!isFinite(v)) v = null;

    groups[g] = groups[g] || { devices: {} };
    groups[g].devices[d] = groups[g].devices[d] || { metrics: {} };
    const ms = groups[g].devices[d].metrics;
    if (!ms[metrica]) ms[metrica] = { vals: [], unit, last: v, ts: Date.now(), color: colorFor(), canvas: null };
    const m = ms[metrica];
    m.unit = unit; m.last = v; m.ts = Date.now();
    if (v != null) { m.vals.push(v); if (m.vals.length > MAXPTS) m.vals.shift(); }
    seen[g] = Date.now();

    msgTimes.push(Date.now());
    feed(topic, v, unit);
    structureDirty = true;
  }

  const online = (g) => Date.now() - (seen[g] || 0) < 12000;

  let structureDirty = true;
  function buildStructure() {
    const names = Object.keys(groups).sort();
    $("#empty").style.display = names.length ? "none" : "block";
    const host = $("#series");
    names.forEach((g) => {
      let gEl = host.querySelector(`[data-g="${CSS.escape(g)}"]`);
      if (!gEl) {
        gEl = document.createElement("div"); gEl.className = "grupo"; gEl.dataset.g = g;
        gEl.innerHTML = `<div class="gh"><span class="gn">${g}</span><span class="gm" data-gm></span></div><div data-devs></div>`;
        host.appendChild(gEl);
      }
      const devs = Object.keys(groups[g].devices).sort();
      gEl.querySelector("[data-gm]").textContent =
        `${devs.length} dispositivo${devs.length === 1 ? "" : "s"} · ${online(g) ? "activo" : "sin datos recientes"}`;
      const devHost = gEl.querySelector("[data-devs]");
      devs.forEach((d) => {
        let dEl = devHost.querySelector(`[data-d="${CSS.escape(d)}"]`);
        if (!dEl) {
          dEl = document.createElement("div"); dEl.className = "devblock"; dEl.dataset.d = d;
          dEl.innerHTML = `<div class="dh"><span class="st"></span>${d}</div><div data-metrics></div>`;
          devHost.appendChild(dEl);
        }
        const ms = groups[g].devices[d].metrics;
        const mHost = dEl.querySelector("[data-metrics]");
        Object.keys(ms).sort().forEach((metrica) => {
          const m = ms[metrica];
          let row = mHost.querySelector(`[data-m="${CSS.escape(metrica)}"]`);
          if (!row) {
            row = document.createElement("div"); row.className = "mrow"; row.dataset.m = metrica;
            row.innerHTML = `<span class="mname">${metrica}</span>`;
            const spark = document.createElement("div"); spark.className = "spark";
            const cv = document.createElement("canvas"); spark.appendChild(cv);
            row.appendChild(spark);
            const val = document.createElement("span"); val.className = "mval"; val.dataset.val = "1";
            row.appendChild(val);
            mHost.appendChild(row);
            m.canvas = cv;
          }
          row.querySelector("[data-val]").textContent = (m.last != null ? m.last : "—") + (m.unit ? " " + m.unit : "");
          row.querySelector("[data-val]").style.color = m.color;
        });
      });
    });
    structureDirty = false;
  }

  function draw(cv, vals, color) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(cv.clientWidth || 160, 2400), h = cv.clientHeight || 34;
    if (w < 2) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (vals.length < 2) return;
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const X = (i) => 3 + (i / (vals.length - 1)) * (w - 6);
    const Y = (v) => h - 4 - ((v - mn) / rng) * (h - 8);
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(vals.length - 1), Y(vals[vals.length - 1]), 2.4, 0, 7); ctx.fill();
  }
  function redraw() {
    for (const g in groups) for (const d in groups[g].devices) {
      const ms = groups[g].devices[d].metrics;
      for (const k in ms) if (ms[k].canvas) draw(ms[k].canvas, ms[k].vals, ms[k].color);
    }
  }

  const feedEl = $("#feed");
  function feed(topic, v, unit) {
    if (feedEl.firstElementChild && feedEl.firstElementChild.classList.contains("empty")) feedEl.innerHTML = "";
    const li = document.createElement("li");
    const t = new Date().toLocaleTimeString("es-CO", { hour12: false });
    const leaf = topic.split("/").slice(1).join("/");
    li.innerHTML = `<span class="tt">${t}</span><span class="tp">${leaf}</span><span class="pl">${v != null ? v : "—"} ${unit || ""}</span>`;
    feedEl.prepend(li);
    while (feedEl.children.length > 22) feedEl.lastChild.remove();
  }

  function rate() {
    const now = Date.now();
    msgTimes = msgTimes.filter((t) => now - t < 5000);
    const r = (msgTimes.length / 5).toFixed(1);
    $("#s-rate").textContent = r;
    $("#feed-rate").textContent = r + " msg/s";
  }

  function setStatus(on, t) { $("#status").classList.toggle("on", on); $("#status-t").textContent = t; }

  const client = mqtt.connect(URL, { reconnectPeriod: 2000 });
  client.on("connect", () => { setStatus(true, "conectado"); client.subscribe("taller/#", { qos: 0 }); });
  client.on("reconnect", () => setStatus(false, "reconectando…"));
  client.on("close", () => setStatus(false, "desconectado"));
  client.on("message", (t, p) => ingest(t, p.toString()));

  // bucle de refresco (desacoplado de la llegada de mensajes)
  setInterval(() => { if (structureDirty) buildStructure(); redraw(); rate(); }, 500);

  async function stats() {
    try {
      const s = await (await fetch("/api/stats")).json();
      $("#s-cli").textContent = s.clientes_conectados ?? 0;
      $("#s-store").textContent = (s.lecturas ?? 0).toLocaleString("es-CO");
      $("#s-db").textContent = s.almacenamiento === "postgres" ? "Postgres" : "memoria";
    } catch (_) {}
    // contadores en vivo (de lo que vemos)
    const gs = Object.keys(groups);
    let dev = 0, met = 0;
    gs.forEach((g) => { const ds = Object.keys(groups[g].devices); dev += ds.length; ds.forEach((d) => (met += Object.keys(groups[g].devices[d].metrics).length)); });
    $("#s-grupos").textContent = gs.length;
    $("#s-dev").textContent = dev;
    $("#s-met").textContent = met;
  }
  stats(); setInterval(stats, 3000);
})();
