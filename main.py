import asyncio
import os
import mimetypes
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from data import get_all_data
from starlette.websockets import WebSocketState




# FORCE LE NAVIGATEUR A RECONNAITRE LE CSS ET LE JS SOUS WINDOWS
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

# 1. CRÉATION DE L'APPLICATION (À METTRE OBLIGATOIREMENT ICI)
app = FastAPI()

# 2. CONFIGURATION DES PERMISSIONS (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/restart")
async def restart_server():
    """Force l'arrêt de FastAPI. Le script batch ou un watcher le relancera."""
    print("⚠️ Demande de redémarrage du serveur reçue !")
    os._exit(0)  # Tue le processus Python instantanément
    
# GESTION DU FLUX DE DONNEES (WEBSOCKET)
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = get_all_data()
            if data and ws.client_state == WebSocketState.CONNECTED:
                await ws.send_json(data)
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("🔌 WebSocket déconnecté")

    except Exception as e:
        print(f"❌ ERREUR WEBSOCKET : {type(e).__name__}: {e}")
    finally:
        if ws.client_state != WebSocketState.DISCONNECTED:
            try:
                await ws.close()
            except:
                pass

# CONFIGURATION DES FICHIERS STATIQUES (L'AFFICHAGE DU HUD)
# On récupère le dossier où se trouve ce fichier main.py
current_dir = os.path.dirname(os.path.realpath(__file__))


@app.get("/data")
async def read_data():
    return get_all_data()
    
    
# On monte le dossier racine. 
# 'html=True' permet de charger index.html automatiquement sur http://127.0.0.1:8000
app.mount("/", StaticFiles(directory=current_dir, html=True), name="static")