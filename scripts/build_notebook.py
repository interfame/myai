#!/usr/bin/env python3
"""Genera colab/myai_brain.ipynb — el cerebro de MyAI en Google Colab."""
import json

CELLS = []

def md(source):
    CELLS.append({"cell_type": "markdown", "metadata": {}, "source": source.strip().split("\n")})

def code(source):
    CELLS.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": source.strip("\n").split("\n")})

# ---------- Título ----------
md(r"""
# 🧠 MyAI Brain — Llama-3-8B-Uncensored en Google Colab

**El cerebro libre de tu plataforma MyAI.** Este notebook:

1. ⚡ Carga **Llama-3-8B-Lexi-Uncensored** (GGUF Q4_K_M, ~5GB) en la GPU T4 gratuita
2. 🌐 Levanta un **servidor API** (FastAPI) con endpoints `/health` y `/chat` (streaming SSE)
3. 🔗 Abre un **túnel público** con cloudflared (sin cuenta, sin tokens)
4. 📡 **Se auto-registra** en tu plataforma MyAI → la web se conecta sola al cerebro
5. 💓 Mantiene latido activo para evitar desconexiones por inactividad

---

### 🚀 Cómo usarlo (3 pasos)
1. **Entorno**: `Entorno de ejecución → Cambiar tipo de entorno → T4 GPU`
2. Rellena `PLATFORM_URL` y `REGISTRATION_SECRET` en la celda de **CONFIGURACIÓN**
3. `Entorno de ejecución → Ejecutar todo` y espera la URL del túnel 🎉

> ⚠️ **Nota**: mantén la pestaña abierta. Colab Free permite sesiones de hasta ~12h.
> GitHub Actions (incluido en el repo) mantiene la plataforma y el túnel calientes.
""")

# ---------- GPU check ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 1 · Verificar GPU (debe decir: Tesla T4)
# ═══════════════════════════════════════════════
!nvidia-smi --query-gpu=name,memory.total --format=csv
""")

# ---------- Config ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 2 · CONFIGURACIÓN ← ← ← ¡RELLENA ESTO!
# ═══════════════════════════════════════════════

# URL pública de tu plataforma MyAI (donde está desplegado este repo)
# Ej: "https://myai.netlify.app"  |  déjalo vacío para copiar la URL a mano
PLATFORM_URL = ""

# Secreto de registro: debe coincidir con el campo "Secreto de registro"
# de tu plataforma (Ajustes → Cerebro). Evita que extraños conecten cerebros.
REGISTRATION_SECRET = "myai-super-secreto-2025"
""")

# ---------- Instalación ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 3 · Instalar dependencias (~2-4 min)
# ═══════════════════════════════════════════════
import sys, subprocess

def pip(*args):
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", *args], check=True)

print("📦 Instalando fastapi, uvicorn, huggingface_hub...")
pip("fastapi", "uvicorn", "huggingface_hub", "requests")

print("📦 Instalando llama-cpp-python con CUDA (wheel precompilado, ~1-2 min)...")
pip("llama-cpp-python",
    "--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cu124",
    "--no-cache-dir")

print("✅ Instalación completa")
""")

# ---------- Descarga del modelo ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 4 · Descargar Llama-3-8B-Uncensored (~5 GB, 2-5 min)
# Versión: Lexi-Uncensored (abliterada, sin rechazos de fábrica)
# ═══════════════════════════════════════════════
from huggingface_hub import hf_hub_download

MODEL_REPO = "Orengutans/Llama-3-8B-Lexi-Uncensored"
MODEL_FILE = "Llama-3-8B-Lexi-Uncensored.Q4_K_M.gguf"

print(f"⬇️  Descargando {MODEL_FILE}...")
MODEL_PATH = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILE)
print(f"✅ Modelo en: {MODEL_PATH}")
""")

# ---------- Carga del modelo ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 5 · Cargar el modelo en GPU (~1-2 min)
# ═══════════════════════════════════════════════
from llama_cpp import Llama

print("🧠 Cargando Llama-3-8B-Uncensored en la GPU...")
llm = Llama(
    model_path=MODEL_PATH,
    n_gpu_layers=-1,     # todas las capas a la GPU
    n_ctx=8192,          # contexto: memoria de la conversación + aprendizajes
    n_batch=512,
    verbose=False,
)
print("✅ Cerebro listo y sin censura")
""")

# ---------- Servidor ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 6 · Servidor API (FastAPI) — endpoints /health y /chat
# ═══════════════════════════════════════════════
import json, time, threading
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="MyAI Brain")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    stream: bool = True
    max_tokens: int = 1024
    temperature: float = 0.8

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "Llama-3-8B-Lexi-Uncensored (Q4_K_M)",
        "context": llm.n_ctx(),
        "engine": "llama-cpp-python CUDA",
    }

@app.post("/chat")
def chat(req: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if req.stream:
        def generate():
            stream = llm.create_chat_completion(
                messages=messages,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                stream=True,
            )
            for chunk in stream:
                token = chunk["choices"][0].get("delta", {}).get("content")
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")

    out = llm.create_chat_completion(
        messages=messages,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )
    return {"content": out["choices"][0]["message"]["content"]}

def run_server():
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

threading.Thread(target=run_server, daemon=True).start()
time.sleep(4)

import urllib.request
print("🔬 Test local /health:", urllib.request.urlopen("http://127.0.0.1:8000/health").read().decode())
print("✅ Servidor API corriendo en el puerto 8000")
""")

# ---------- Prueba del cerebro ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 7 · Primera conversación con tu IA libre
# ═══════════════════════════════════════════════
import requests

r = requests.post("http://127.0.0.1:8000/chat", json={
    "messages": [
        {"role": "system", "content": "Eres MyAI, la IA personal libre de tu Jefe. Responde en español."},
        {"role": "user", "content": "¡Hola! ¿Quién eres y qué puedes hacer?"},
    ],
    "stream": False,
    "max_tokens": 200,
    "temperature": 0.8,
}, timeout=120)
print(r.json()["content"])
""")

# ---------- Túnel + auto-registro ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 8 · Túnel público (cloudflared, sin cuenta) + AUTO-REGISTRO
# ═══════════════════════════════════════════════
import re, time, threading, subprocess, requests

print("☁️  Descargando cloudflared...")
subprocess.run([
    "wget", "-q", "-O", "/content/cloudflared",
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
], check=True)
subprocess.run(["chmod", "+x", "/content/cloudflared"], check=True)

print("🔗 Abriendo túnel público...")
tunnel_log = open("/content/tunnel.log", "w")
tunnel_proc = subprocess.Popen(
    ["/content/cloudflared", "tunnel", "--url", "http://localhost:8000", "--no-autoupdate"],
    stdout=tunnel_log, stderr=subprocess.STDOUT,
)

public_url = None
for _ in range(45):
    time.sleep(2)
    log = open("/content/tunnel.log").read()
    m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", log)
    if m:
        public_url = m.group(0)
        break

if not public_url:
    raise RuntimeError("❌ No se pudo obtener la URL del túnel. Re-ejecuta esta celda.")

print("=" * 60)
print("🌐 URL PÚBLICA DEL CEREBRO:", public_url)
print("=" * 60)

# ── AUTO-REGISTRO: la plataforma se conecta sola a este cerebro ──
if PLATFORM_URL:
    try:
        r = requests.post(
            f"{PLATFORM_URL.rstrip('/')}/api/tunnel/register",
            json={"url": public_url, "secret": REGISTRATION_SECRET},
            timeout=20,
        )
        print("📡 Auto-registro en la plataforma:", r.json())
        print("🎉 ¡LISTO! Abre tu plataforma y habla con tu IA libre.")
    except Exception as e:
        print(f"⚠️  No pude auto-registrarme ({e}).")
        print(f"   → Copia esta URL manualmente en Ajustes → Cerebro: {public_url}")
else:
    print("ℹ️  PLATFORM_URL vacío → copia esta URL en tu plataforma (Ajustes → Cerebro):")
    print(f"   {public_url}")

# Guarda la URL para el heartbeat
with open("/content/myai_public_url.txt", "w") as f:
    f.write(public_url)
""")

# ---------- Heartbeat ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 9 · HEARTBEAT — evita la desconexión por inactividad
# Un hilo interno se auto-pingüea cada 4 minutos.
# (Además, GitHub Actions pingüea el túnel cada 20 min desde fuera)
# ═══════════════════════════════════════════════
import time, threading, requests, datetime

def heartbeat():
    while True:
        time.sleep(240)
        try:
            requests.get(f"{public_url.rstrip('/')}/health", timeout=15)
            print(f"💓 {datetime.datetime.now():%H:%M:%S} · cerebro vivo en {public_url}")
        except Exception as e:
            print(f"⚠️  {datetime.datetime.now():%H:%M:%S} · heartbeat falló: {e}")

threading.Thread(target=heartbeat, daemon=True).start()
print("💓 Heartbeat activo cada 4 minutos. Deja esta pestaña abierta.")
print("📊 Si el túnel se reconecta con otra URL, re-ejecuta la celda 8.")
""")

# ---------- Cierre ----------
md(r"""
## 🛡️ Consejos para sesiones largas (Colab Free)

| Truco | Cómo |
|---|---|
| **Heartbeat interno** | ✅ Ya activo (celda 9) |
| **Ping externo** | GitHub Actions incluido en el repo → cada 20 min al túnel y a la plataforma |
| **Auto-registro** | Si el túnel cambia de URL tras reconectar, re-ejecuta la celda 8 → la plataforma se actualiza sola |
| **Límite duro de Colab** | ~12h de sesión GPU gratuita. Re-ejecuta todas las celdas para un cerebro nuevo (2-3 min) |
| **No cierres la pestaña** | Colab puede reciclar sesiones de pestañas cerradas antes de tiempo |

## 🧬 El bucle de aprendizaje (resumen)

```
Tú hablas con MyAI (web)
        │
        ▼
Backend: inyecta MEMORIA APRENDIDA al system prompt  ◄──┐
        │                                               │
        ▼                                               │
Cerebro Colab responde (Llama-3-8B-Uncensored)          │
        │                                               │
        ▼                                               │
La IA auto-evalúa el intercambio y extrae               │
aprendizajes valiosos → Supabase/SQLite                 ┘
```

**El robot evoluciona solo. Sin entrenamiento manual. Costo: $0.** 🚀
""")

notebook = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "colab": {"provenance": [], "gpuType": "T4", "toc_visible": True},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
        "accelerator": "GPU",
    },
    "cells": [
        {
            "cell_type": c["cell_type"],
            "metadata": c["metadata"],
            **({"execution_count": None, "outputs": []} if c["cell_type"] == "code" else {}),
            "source": [line + "\n" for line in c["source"][:-1]] + [c["source"][-1]],
        }
        for c in CELLS
    ],
}

with open("/home/z/my-project/colab/myai_brain.ipynb", "w") as f:
    json.dump(notebook, f, ensure_ascii=False, indent=1)

print(f"✅ Notebook generado con {len(CELLS)} celdas")
