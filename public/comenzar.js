/* Rellena los scripts de sensor con el host real, el grupo y el token. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const HOST = location.hostname;      // sin puerto: paho usa host y puerto por separado
  const HOSTPORT = location.host;      // con puerto si lo hay: para la URL wss de Node/navegador
  const WSS = `wss://${HOSTPORT}/mqtt`;
  $("#k-url").textContent = WSS;

  function py(grupo, token) {
    return `import json, time, random
import paho.mqtt.client as mqtt

HOST  = "${HOST}"
PORT  = 443
GRUPO = "${grupo}"          # <-- el nombre de tu grupo
DISPO = "sensor1"           # <-- el nombre de tu dispositivo
TOKEN = "${token}"          # token del taller

c = mqtt.Client(client_id=f"{GRUPO}-{DISPO}", transport="websockets")
c.ws_set_options(path="/mqtt")
c.username_pw_set(GRUPO, TOKEN)
c.tls_set()                 # wss (TLS)
c.connect(HOST, PORT, 60)
c.loop_start()
print("conectado, publicando...  (Ctrl+C para parar)")

try:
    while True:
        base = f"taller/{GRUPO}/{DISPO}"
        t = int(time.time() * 1000)
        temp = round(20 + random.random() * 8, 2)
        hum  = round(50 + random.random() * 20, 1)
        c.publish(f"{base}/temperatura", json.dumps({"v": temp, "u": "C",  "t": t}))
        c.publish(f"{base}/humedad",     json.dumps({"v": hum,  "u": "%",  "t": t}))
        print("->", base, temp, hum)
        time.sleep(2)
except KeyboardInterrupt:
    c.loop_stop(); c.disconnect()`;
  }

  function js(grupo, token) {
    return `const mqtt = require("mqtt");

const HOST  = "${HOSTPORT}";
const GRUPO = "${grupo}";        // <-- el nombre de tu grupo
const DISPO = "sensor1";         // <-- el nombre de tu dispositivo
const TOKEN = "${token}";        // token del taller

const c = mqtt.connect(\`wss://\${HOST}/mqtt\`, {
  username: GRUPO, password: TOKEN, clientId: \`\${GRUPO}-\${DISPO}\`
});

c.on("connect", () => {
  console.log("conectado, publicando...");
  setInterval(() => {
    const base = \`taller/\${GRUPO}/\${DISPO}\`, t = Date.now();
    c.publish(\`\${base}/temperatura\`, JSON.stringify({ v: +(20 + Math.random()*8).toFixed(2), u: "C", t }));
    c.publish(\`\${base}/humedad\`,     JSON.stringify({ v: +(50 + Math.random()*20).toFixed(1), u: "%", t }));
  }, 2000);
});
c.on("error", (e) => console.error(e.message));`;
  }

  function render() {
    const grupo = ($("#grupo").value.trim() || "grupo1").toLowerCase();
    const token = $("#token").value.trim() || "PON-AQUI-EL-TOKEN";
    $("#code-py").textContent = py(grupo, token);
    $("#code-js").textContent = js(grupo, token);
  }
  $("#grupo").addEventListener("input", render);
  $("#token").addEventListener("input", render);
  render();

  document.querySelectorAll(".copy").forEach((b) =>
    b.addEventListener("click", async () => {
      const txt = $("#code-" + b.dataset.copy).textContent;
      try { await navigator.clipboard.writeText(txt); b.textContent = "¡copiado!"; }
      catch (_) {
        const r = document.createRange(); r.selectNode($("#code-" + b.dataset.copy));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = "selecciona y Ctrl+C";
      }
      setTimeout(() => (b.textContent = "copiar"), 1800);
    })
  );
})();
