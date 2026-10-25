# Taller S11 — Conecta tus sensores al broker MQTT

Hoy cada grupo va a **crear sus dispositivos** y **conectarlos** al broker MQTT del
curso (está desplegado en Railway, funciona como un “HiveMQ” del salón). La próxima
clase construirán su propio **dashboard** con estos datos.

## Lo que necesitas (te lo da el docente)

| Dato | Ejemplo |
|---|---|
| URL de la app | `https://<app>.up.railway.app` |
| Broker (WebSocket) | `wss://<app>.up.railway.app/mqtt` |
| Token del taller | (una sola contraseña para todo el salón) |
| Nombre de tu grupo | `grupo1`, `grupo2`, … |

Tus mensajes van a tópicos con esta estructura (UNS / ISA-95):

```
taller/<grupo>/<dispositivo>/<métrica>
taller/grupo3/banda/temperatura     →  {"v": 24.7, "u": "C", "t": 1730000000000}
```

> Solo puedes publicar bajo el nombre de **tu** grupo. Leer es abierto.

## Tu tarea — crear el script con MÍNIMO 3 sensores diferentes

1. Entra a `https://<app>.up.railway.app/comenzar.html` — ahí tienes el script ya
   rellenado con la URL. Cópialo (Python o Node). O usa `sensor.py` / `sensor.js` de esta carpeta.
2. Edita: tu `GRUPO` y el `TOKEN` del taller.
3. Edita la lista `SENSORES`: deja **al menos 3 dispositivos diferentes**, cada uno con su
   métrica, unidad y rango. Tres ejemplos para arrancar (cámbialos por los de tu proyecto):

   | Dispositivo | Métrica | Unidad | Rango |
   |---|---|---|---|
   | `tanque_leche` | nivel | % | 40–95 |
   | `banda_envasado` | velocidad | m/s | 0.2–1.5 |
   | `camara_frio` | temperatura | °C | 2–8 |

4. Instala la librería y ejecuta:

   **Python**
   ```bash
   pip install paho-mqtt
   python sensor.py
   ```

   **Node**
   ```bash
   npm init -y && npm install mqtt
   node sensor.js
   ```
5. Debes ver `conectado como '<grupo>' con 3 sensores` en tu consola.
6. Abre `https://<app>.up.railway.app/taller.html` — tus **3 dispositivos** aparecen bajo tu
   grupo y sus lecturas quedan guardadas en la base de datos.

## Reto del día

- Que tus **3 sensores distintos** publiquen a la vez y se vean juntos en el monitor del taller.
- Que tengan sentido para tu proyecto (nivel, temperatura, velocidad, conteo, OEE…). La
  estructura del tópico `taller/<grupo>/<dispositivo>/<métrica>` es tu diseño del UNS.

## Si algo falla

- **No conecta:** revisa que la URL sea `wss://...` y que el **token** y el **grupo**
  estén bien escritos (sin espacios, en minúsculas).
- **Conecta pero no publica:** el grupo del tópico debe ser igual a tu usuario/grupo.
- **No aparece en el taller:** espera unos segundos y recarga `/taller.html`.
