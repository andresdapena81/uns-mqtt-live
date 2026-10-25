/* Monitor del taller: se suscribe a taller/# (lectura abierta) y agrupa por grupo→dispositivo→métrica. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const URL = `${proto}://${location.host}/mqtt`;

  // estado: grupos[grupo].devices[dispositivo].metrics[metrica] = {value, ts}
  const grupos = {};
  const seen = {}; // grupo -> última actividad (ms) para marcar online/offline

  function upsert(topic, payload) {
    const p = topic.split("/"); // taller/grupo/dispositivo/metrica...
    if (p.length < 4) return;
    const [, g, d] = p;
    const metrica = p.slice(3).join("/");
    let value = payload;
    try { const o = JSON.parse(payload); if (o && typeof o === "object" && "v" in o) value = o.v + (o.u ? " " + o.u : ""); } catch (_) {}
    grupos[g] = grupos[g] || { devices: {} };
    grupos[g].devices[d] = grupos[g].devices[d] || { metrics: {} };
    grupos[g].devices[d].metrics[metrica] = { value, ts: Date.now() };
    seen[g] = Date.now();
    render();
  }
  function online(g) { return Date.now() - (seen[g] || 0) < 12000; }

  function render() {
    const names = Object.keys(grupos).sort();
    $("#empty").style.display = names.length ? "none" : "block";
    $("#grupos").innerHTML = names.map((g) => {
      const devs = Object.keys(grupos[g].devices).sort();
      const nDev = devs.length;
      const dev = devs.map((d) => {
        const ms = grupos[g].devices[d].metrics;
        const rows = Object.keys(ms).sort().map((m) =>
          `<div class="metric"><span class="mk">${m}</span><span class="mv">${ms[m].value}</span></div>`).join("");
        return `<div class="devbox"><div class="dnm"><span class="st"></span>${d}</div>${rows}</div>`;
      }).join("");
      return `<div class="grupo">
        <div class="gh"><span class="gn">${g}</span>
          <span class="gm">${nDev} dispositivo${nDev === 1 ? "" : "s"} · ${online(g) ? "activo" : "sin datos recientes"}</span></div>
        <div class="dgrid">${dev}</div></div>`;
    }).join("");
  }

  function setStatus(on, t) { $("#status").classList.toggle("on", on); $("#status-t").textContent = t; }

  const client = mqtt.connect(URL, { reconnectPeriod: 2000 });
  client.on("connect", () => { setStatus(true, "conectado"); client.subscribe("taller/#", { qos: 0 }); });
  client.on("reconnect", () => setStatus(false, "reconectando…"));
  client.on("close", () => setStatus(false, "desconectado"));
  client.on("message", (t, p) => upsert(t, p.toString()));

  // estadísticas de almacenamiento (API)
  async function stats() {
    try {
      const r = await fetch("/api/stats"); const s = await r.json();
      $("#s-grupos").textContent = s.grupos ?? 0;
      $("#s-dev").textContent = s.dispositivos ?? 0;
      $("#s-cli").textContent = s.clientes_conectados ?? 0;
      $("#s-store").textContent = (s.lecturas ?? 0).toLocaleString("es-CO");
      $("#s-db").textContent = s.almacenamiento === "postgres" ? "Postgres" : "memoria";
    } catch (_) {}
  }
  stats(); setInterval(stats, 4000);
  setInterval(render, 5000); // refresca marcas de actividad
})();
