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
TOKEN = "${token}"          # token del taller

# >>> MINIMO 3 SENSORES DIFERENTES — edita esta lista <<<
SENSORES = [
    {"dispositivo": "tanque_leche",   "metrica": "nivel",       "unidad": "%",   "min": 40,  "max": 95},
    {"dispositivo": "banda_envasado", "metrica": "velocidad",   "unidad": "m/s", "min": 0.2, "max": 1.5},
    {"dispositivo": "camara_frio",    "metrica": "temperatura", "unidad": "C",   "min": 2,   "max": 8},
]

CID = f"{GRUPO}-{random.randint(1000, 9999)}"
try:  # paho-mqtt 2.x
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=CID, transport="websockets")
except AttributeError:  # paho-mqtt 1.x
    c = mqtt.Client(client_id=CID, transport="websockets")
c.ws_set_options(path="/mqtt")
c.username_pw_set(GRUPO, TOKEN)
c.tls_set()                 # wss (TLS)
c.connect(HOST, PORT, 60)
c.loop_start()
print(f"conectado como '{GRUPO}' con {len(SENSORES)} sensores. (Ctrl+C para parar)")

try:
    while True:
        t = int(time.time() * 1000)
        for s in SENSORES:
            valor = round(random.uniform(s["min"], s["max"]), 2)
            topico = f"taller/{GRUPO}/{s['dispositivo']}/{s['metrica']}"
            c.publish(topico, json.dumps({"v": valor, "u": s["unidad"], "t": t}))
            print("->", topico, valor, s["unidad"])
        print("---")
        time.sleep(2)
except KeyboardInterrupt:
    c.loop_stop(); c.disconnect()`;
  }

  function js(grupo, token) {
    return `const mqtt = require("mqtt");

const HOST  = "${HOSTPORT}";
const GRUPO = "${grupo}";        // <-- el nombre de tu grupo
const TOKEN = "${token}";        // token del taller

// >>> MINIMO 3 SENSORES DIFERENTES — edita esta lista <<<
const SENSORES = [
  { dispositivo: "tanque_leche",   metrica: "nivel",       unidad: "%",   min: 40,  max: 95 },
  { dispositivo: "banda_envasado", metrica: "velocidad",   unidad: "m/s", min: 0.2, max: 1.5 },
  { dispositivo: "camara_frio",    metrica: "temperatura", unidad: "C",   min: 2,   max: 8 },
];

const c = mqtt.connect(\`wss://\${HOST}/mqtt\`, {
  username: GRUPO, password: TOKEN, clientId: \`\${GRUPO}-\${Math.floor(1000 + Math.random()*9000)}\`
});

c.on("connect", () => {
  console.log(\`conectado como '\${GRUPO}' con \${SENSORES.length} sensores.\`);
  setInterval(() => {
    const t = Date.now();
    for (const s of SENSORES) {
      const valor = +(s.min + Math.random() * (s.max - s.min)).toFixed(2);
      c.publish(\`taller/\${GRUPO}/\${s.dispositivo}/\${s.metrica}\`, JSON.stringify({ v: valor, u: s.unidad, t }));
      console.log("->", s.dispositivo, s.metrica, valor, s.unidad);
    }
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
