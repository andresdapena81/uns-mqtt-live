/* Dashboard: habla MQTT sobre WebSocket contra el broker Aedes real del servidor. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const URL = `${proto}://${location.host}/mqtt`;
  $("#brokerurl").textContent = URL;

  const BASE = "lacteos/bello/envasado/linea2";
  const DEVICES = ["pasteurizador", "fermentador", "dosificadora"];

  // ---- estado de UI ----
  const bus = new Map(); // topic -> {value, unit, ts}
  const busEl = $("#bus");
  const devState = {};

  function fmtAge(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    return s < 1 ? "ahora" : s + "s";
  }
  function parse(payloadStr) {
    try {
      const o = JSON.parse(payloadStr);
      if (o && typeof o === "object" && "v" in o) return { value: o.v, unit: o.u || "", ts: o.t || Date.now() };
    } catch (_) {}
    return { value: payloadStr, unit: "", ts: Date.now() };
  }
  function renderBus() {
    const rows = [...bus.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    busEl.innerHTML = rows
      .map(([topic, d]) => {
        const parts = topic.split("/");
        const leaf = parts.slice(-1)[0];
        const prefix = parts.slice(0, -1).join("/") + "/";
        const val = typeof d.value === "number" ? d.value : String(d.value);
        return `<tr data-t="${topic}"><td class="topic">${prefix}<span class="leaf">${leaf}</span></td>
          <td class="val">${val} <span class="u">${d.unit || ""}</span></td>
          <td class="age" data-ts="${d.ts}">${fmtAge(d.ts)}</td></tr>`;
      })
      .join("");
    $("#bus-count").textContent = bus.size + " tópicos";
  }
  function flashRow(topic) {
    const tr = busEl.querySelector(`tr[data-t="${CSS.escape(topic)}"]`);
    if (tr) { tr.classList.add("flash"); setTimeout(() => tr.classList.remove("flash"), 120); }
  }
  // refresca la columna "edad" cada segundo
  setInterval(() => {
    busEl.querySelectorAll("td.age").forEach((td) => (td.textContent = fmtAge(+td.dataset.ts)));
  }, 1000);

  function renderDevs() {
    $("#devs").innerHTML = DEVICES.map((d) => {
      const st = devState[d] || "desconocido";
      const cls = st === "online" ? "online" : st === "offline" ? "offline" : "";
      const nice = { pasteurizador: "Pasteurizador PZ-01", fermentador: "Fermentador FT-02", dosificadora: "Dosificadora DS-05" }[d];
      return `<div class="dev"><span class="st ${cls}"></span><span class="dn">${nice}</span>
        <span class="ds ${cls}">${st.toUpperCase()}</span></div>`;
    }).join("");
  }
  DEVICES.forEach((d) => (devState[d] = "…"));
  renderDevs();

  // ---- estado de conexión ----
  function setStatus(on, text) {
    const el = $("#status");
    el.classList.toggle("on", on);
    $("#status-t").textContent = text;
  }

  // ---- cliente MQTT ----
  const client = mqtt.connect(URL, { reconnectPeriod: 2000, connectTimeout: 8000 });

  client.on("connect", () => {
    setStatus(true, "conectado");
    client.subscribe("lacteos/#", { qos: 0 });
    subscribeUser($("#sub-filter").value.trim());
  });
  client.on("reconnect", () => setStatus(false, "reconectando…"));
  client.on("close", () => setStatus(false, "desconectado"));
  client.on("error", (e) => setStatus(false, "error: " + (e && e.message ? e.message : e)));

  client.on("message", (topic, payloadBuf) => {
    const payloadStr = payloadBuf.toString();

    // estado de dispositivos (.../<dev>/status)
    const m = topic.match(new RegExp(`^${BASE}/([^/]+)/status$`));
    if (m && DEVICES.includes(m[1])) {
      devState[m[1]] = payloadStr;
      renderDevs();
      return;
    }

    // telemetría → bus
    const d = parse(payloadStr);
    bus.set(topic, d);
    renderBus();
    flashRow(topic);

    // alimenta la suscripción del usuario
    if (userSub && matches(userSub, topic)) pushUser(topic, d);
  });

  // ---- suscripción del usuario ----
  let userSub = null;
  let userCount = 0;
  const feedEl = $("#sub-feed");

  function pushUser(topic, d) {
    if (feedEl.firstElementChild && feedEl.firstElementChild.classList.contains("empty")) feedEl.innerHTML = "";
    const li = document.createElement("li");
    const leaf = topic.split("/").slice(-2).join("/");
    const val = typeof d.value === "number" ? d.value : String(d.value);
    const t = new Date().toLocaleTimeString("es-CO", { hour12: false });
    li.innerHTML = `<span class="tt">${t}</span><span class="tp">${leaf}</span><span class="pl">${val}</span>`;
    feedEl.prepend(li);
    while (feedEl.children.length > 7) feedEl.lastChild.remove();
    userCount++;
    $("#sub-count").textContent = userCount + " msg";
  }
  // matching local solo para contabilizar en el panel (el broker también filtra de verdad)
  function matches(sub, topic) {
    const s = sub.split("/"), tp = topic.split("/");
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "#") return i === s.length - 1;
      if (i >= tp.length) return false;
      if (s[i] === "+") continue;
      if (s[i] !== tp[i]) return false;
    }
    return s.length === tp.length;
  }
  function subscribeUser(filter) {
    if (!filter) return;
    if (userSub && userSub !== filter) client.unsubscribe(userSub);
    userSub = filter;
    userCount = 0;
    $("#sub-count").textContent = "0 msg";
    feedEl.innerHTML = '<li class="empty">— esperando mensajes de ' + filter + " —</li>";
    client.subscribe(filter, { qos: 0 });
  }
  $("#sub-btn").addEventListener("click", () => subscribeUser($("#sub-filter").value.trim()));
  $("#sub-filter").addEventListener("keydown", (e) => { if (e.key === "Enter") subscribeUser($("#sub-filter").value.trim()); });

  // ---- publicar ----
  $("#pub-btn").addEventListener("click", () => {
    const topic = $("#pub-topic").value.trim();
    const payload = $("#pub-payload").value;
    if (topic) client.publish(topic, payload, { qos: 0 });
  });
})();
