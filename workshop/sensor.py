# Sensor del taller — publica VARIOS sensores a tu broker MQTT (sobre WebSocket / wss).
# Requisito:  pip install paho-mqtt
# Ejecuta:    python sensor.py
#
# TU TAREA: deja al menos 3 sensores DIFERENTES en la lista SENSORES
#           (cambia nombres, métricas, unidades y rangos por los de tu proyecto).

import json
import time
import random
import paho.mqtt.client as mqtt

HOST  = "TU-APP.up.railway.app"   # dominio de la app en Railway (sin https:// ni /mqtt)
PORT  = 443
GRUPO = "grupo1"                  # <-- el nombre de tu grupo (será tu usuario)
TOKEN = "PON-AQUI-EL-TOKEN"       # token del taller (tu contraseña)

# >>> MÍNIMO 3 SENSORES DIFERENTES — edita esta lista <<<
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
c.tls_set()                       # conexión segura wss (TLS)
c.connect(HOST, PORT, 60)
c.loop_start()
print(f"conectado como '{GRUPO}' con {len(SENSORES)} sensores.  (Ctrl+C para parar)")

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
    c.loop_stop()
    c.disconnect()
    print("\ndesconectado")
