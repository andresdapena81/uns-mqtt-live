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

## Pasos

1. Entra a `https://<app>.up.railway.app/comenzar.html` — ahí tienes el script ya
   rellenado con la URL. Cópialo (Python o Node).
2. O usa los archivos de esta carpeta: `sensor.py` (Python) o `sensor.js` (Node).
3. Edita en el script: `GRUPO`, `DISPO` (nombre del dispositivo) y `TOKEN`.
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
5. Deberías ver `conectado, publicando...` en tu consola.
6. Abre `https://<app>.up.railway.app/taller.html` — **tu dispositivo aparece en vivo**
   y sus lecturas quedan guardadas en la base de datos.

## Reto del día

- Crea **2 dispositivos distintos** en tu grupo (p. ej. `banda` y `tanque`), cada uno con
  su métrica, y míralos juntos en el monitor del taller.
- Cambia los valores simulados por algo con sentido para tu proyecto (temperatura,
  conteo, nivel, OEE…). La estructura del tópico es tu decisión de diseño del UNS.

## Si algo falla

- **No conecta:** revisa que la URL sea `wss://...` y que el **token** y el **grupo**
  estén bien escritos (sin espacios, en minúsculas).
- **Conecta pero no publica:** el grupo del tópico debe ser igual a tu usuario/grupo.
- **No aparece en el taller:** espera unos segundos y recarga `/taller.html`.
