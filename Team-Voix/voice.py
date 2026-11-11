import os
import asyncio
import edge_tts
import pygame
import threading
import queue
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

# L'interface Electron est servie depuis file:// et envoie Origin: null.
# Refuser les origines Web inattendues réduit les requêtes cross-origin.
ALLOWED_ORIGINS = {None, "null", "file://"}

@app.before_request
def restrict_origins():
    origin = request.headers.get("Origin")
    if origin not in ALLOWED_ORIGINS:
        return jsonify({"status": "error", "reason": "origin not allowed"}), 403
    if request.method == "OPTIONS":
        return "", 204

@app.after_request
def allow_local_file_ui(response):
    if request.headers.get("Origin") == "null":
        response.headers["Access-Control-Allow-Origin"] = "null"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Vary"] = "Origin"
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_AUDIO = os.path.join(BASE_DIR, "voice_temp.mp3")

# Assets radio
NOISE_STATIC = os.path.join(BASE_DIR, "assets", "mp3", "radio-static.mp3")
NOISE_START = os.path.join(BASE_DIR, "assets", "mp3", "radio-static-2.mp3")

# --- VOIX ---
VOICES = {
    0: "fr-FR-DeniseNeural",
    1: "fr-FR-HenriNeural",
    2: "fr-CA-AntoineNeural",
    3: "fr-FR-VivienneMultilingualNeural",
    4: "fr-BE-GerardNeural",
    5: "fr-CH-ArianeNeural",
    6: "fr-FR-RemyMultilingualNeural",
    7: "fr-FR-EloiseNeural",
    8: "fr-BE-CharlineNeural",
    9: "fr-CA-SylvieNeural",
    10: "fr-CA-ThierryNeural",
    11: "fr-CH-FabriceNeural"
}

# Queue audio
voice_queue = queue.Queue()
audio_ready = False
audio_error = "Initialisation audio en cours"

# --- ANTI-DOUBLON ---
last_spoken = {}          # id -> timestamp
COOLDOWN_SECONDS = 3.0    # délai minimum entre deux mêmes alertes


def voice_worker():
    global audio_ready, audio_error
    try:
        pygame.mixer.pre_init(8000, -16, 1, 512)
        pygame.mixer.init()
        audio_ready = True
        audio_error = None
        print(f"[AUDIO] Sortie audio prête : {pygame.mixer.get_init()}", flush=True)
    except Exception as e:
        audio_ready = False
        audio_error = f"Initialisation audio : {type(e).__name__}: {e}"
        print(f"[AUDIO] Erreur init mixer : {e}")
        return

    while True:
        data = voice_queue.get()
        if data is None:
            break

        text = data.get("text")
        v_idx = data.get("voice_index", 0)
        voice = VOICES.get(v_idx, VOICES[0])

        try:
            async def generate():
                communicate = edge_tts.Communicate(
                    text=text,
                    voice=voice,
                    volume="+100%"
                )
                await communicate.save(TEMP_AUDIO)

            asyncio.run(generate())

            if os.path.exists(TEMP_AUDIO):

                # Bip radio start
                if os.path.exists(NOISE_START):
                    start_snd = pygame.mixer.Sound(NOISE_START)
                    pygame.mixer.Channel(0).play(start_snd)
                    time.sleep(0.15)
                    pygame.mixer.Channel(0).stop()

                # Friture radio
                if os.path.exists(NOISE_STATIC):
                    static_snd = pygame.mixer.Sound(NOISE_STATIC)
                    pygame.mixer.Channel(1).set_volume(0.05)
                    pygame.mixer.Channel(1).play(static_snd, loops=-1)

                # Voix
                voice_snd = pygame.mixer.Sound(TEMP_AUDIO)
                pygame.mixer.Channel(0).set_volume(1.0)
                pygame.mixer.Channel(0).play(voice_snd)

                while pygame.mixer.Channel(0).get_busy():
                    time.sleep(0.05)

                pygame.mixer.Channel(1).stop()

        except Exception as e:
            audio_error = f"{type(e).__name__}: {e}"
            print(f"[AUDIO] Erreur worker : {e}")
        else:
            audio_error = None

        finally:
            voice_queue.task_done()


# Thread audio
threading.Thread(target=voice_worker, daemon=True).start()


# --- API ---

@app.route("/speak", methods=["POST", "OPTIONS"])
def speak():
    global audio_error
    data = request.json or {}

    text = data.get("text", "").strip()
    if not text:
        return jsonify({"status": "ignored", "reason": "empty text"})
    if not audio_ready:
        return jsonify({"status": "error", "reason": audio_error or "audio unavailable"}), 503
    if len(text) > 500:
        return jsonify({"status": "error", "reason": "text too long"}), 413

    try:
        voice_index = int(data.get("voice_index", 0))
    except (TypeError, ValueError):
        voice_index = 0
    if voice_index not in VOICES:
        voice_index = 0

    if voice_queue.qsize() >= 50:
        return jsonify({"status": "error", "reason": "queue full"}), 429

    alert_id = data.get("id")
    now = time.time()

    # --- COOLDOWN PAR ID ---
    if alert_id:
        last = last_spoken.get(alert_id, 0)
        if now - last < COOLDOWN_SECONDS:
            return jsonify({
                "status": "ignored",
                "reason": "cooldown",
                "id": alert_id
            })
        last_spoken[alert_id] = now

    audio_error = None
    voice_queue.put({
        "id": alert_id,
        "text": text,
        "voice_index": voice_index,
        "time": now
    })

    return jsonify({"status": "queued"})


@app.route("/status", methods=["GET"])
def get_status():
    playing = False
    if audio_ready:
        try:
            playing = pygame.mixer.Channel(0).get_busy()
        except Exception as e:
            return jsonify({"ready": False, "playing": False, "error": f"{type(e).__name__}: {e}"})
    return jsonify({"ready": audio_ready, "playing": playing, "error": audio_error})


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("SIMRACINGONE_VOICE_PORT", "5000")),
        debug=False,
        use_reloader=False
    )
