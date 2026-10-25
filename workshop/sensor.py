# Sensor del taller — publica a tu broker MQTT (sobre WebSocket / wss).
# Requisito:  pip install paho-mqtt
# Ejecuta:    python sensor.py
#
# Edita HOST, GRUPO, DISPO y TOKEN con los datos que te dio el docente
# (o cópialos ya rellenos desde la página /comenzar de la app).

import json
import time
import random
import paho.mqtt.client as mqtt

HOST  = "TU-APP.up.railway.app"   # dominio de la app en Railway (sin https:// ni /mqtt)
PORT  = 443
GRUPO = "grupo1"                  # <-- el nombre de tu grupo (será tu usuario)
DISPO = "sensor1"                 # <-- el nombre de tu dispositivo
TOKEN = "PON-AQUI-EL-TOKEN"       # token del taller (tu contraseña)

c = mqtt.Client(client_id=f"{GRUPO}-{DISPO}", transport="websockets")
c.ws_set_options(path="/mqtt")
c.username_pw_set(GRUPO, TOKEN)
c.tls_set()                       # conexión segura wss (TLS)
c.connect(HOST, PORT, 60)
c.loop_start()
print("conectado, publicando...  (Ctrl+C para parar)")

try:
    while True:
        base = f"taller/{GRUPO}/{DISPO}"
        t = int(time.time() * 1000)
        temp = round(20 + random.random() * 8, 2)   # cambia por tu dato real
        hum  = round(50 + random.random() * 20, 1)
        c.publish(f"{base}/temperatura", json.dumps({"v": temp, "u": "C", "t": t}))
        c.publish(f"{base}/humedad",     json.dumps({"v": hum,  "u": "%", "t": t}))
        print("->", base, "temp", temp, "hum", hum)
        time.sleep(2)
except KeyboardInterrupt:
    c.loop_stop()
    c.disconnect()
    print("\ndesconectado")
