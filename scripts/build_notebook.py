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

1. ⚡ Carga **Llama-3-8B-Lexi-Uncensored** (GGUF Q4_K_M, ~5GB, con mirrors de respaldo) en la GPU T4 gratuita, usando **Ollama** (CUDA incluido, cero errores de librerías)
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
# CELDA 3 · Instalar OLLAMA — el motor del cerebro (~1-2 min)
# ¿Por qué Ollama? Trae SUS PROPIAS librerías CUDA incluidas → funciona en
# cualquier versión de Colab sin errores de libcudart/compilación.
# ═══════════════════════════════════════════════
import os, time, subprocess, urllib.request

print("📦 Instalando dependencias ligeras (fastapi, uvicorn, huggingface_hub)...")
subprocess.run("pip install -q fastapi uvicorn huggingface_hub requests", shell=True)

print("📦 Instalando Ollama (~1 GB, incluye CUDA)...")
res = subprocess.run(
    "curl -fsSL https://ollama.com/install.sh | sh > /content/ollama_install.log 2>&1",
    shell=True,
)
if res.returncode != 0:
    print(open("/content/ollama_install.log").read()[-1500:])
    raise RuntimeError("❌ Falló la instalación de Ollama. Re-ejecuta esta celda.")
print("   → Ollama instalado")

print("🚀 Arrancando el servidor de Ollama en segundo plano...")
env = dict(os.environ, OLLAMA_MODELS="/content/ollama_models")
subprocess.Popen(
    ["ollama", "serve"], env=env,
    stdout=open("/content/ollama.log", "w"), stderr=subprocess.STDOUT,
)

for _ in range(30):
    time.sleep(2)
    try:
        urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=3)
        print("✅ Ollama activo en el puerto 11434 (detecta la T4 solo)")
        break
    except Exception:
        pass
else:
    print(open("/content/ollama.log").read()[-1500:])
    raise RuntimeError("❌ Ollama no arrancó. Re-ejecuta esta celda.")
""")

# ---------- Descarga del modelo ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 4 · Descargar Llama-3-8B-Uncensored (~5 GB, 2-5 min)
# ℹ️  HuggingFace aquí es SOLO el servidor de archivos de donde se baja el
#     modelo (como descargar un .zip). No necesitas cuenta ni nada: todo el
#     cerebro corre 100% en Google Colab.
# ═══════════════════════════════════════════════
from huggingface_hub import hf_hub_download

# Cadena de mirrors públicos (se intentan en orden hasta que uno funcione)
MODELOS = [
    ("Orenguteng/Llama-3-8B-Lexi-Uncensored-GGUF", "Lexi-Llama-3-8B-Uncensored_Q4_K_M.gguf"),
    ("bartowski/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF", "Llama-3.1-8B-Lexi-Uncensored-V2-Q4_K_M.gguf"),
]

MODEL_PATH = None
for repo_id, filename in MODELOS:
    try:
        print(f"⬇️  Descargando {filename} desde {repo_id}...")
        MODEL_PATH = hf_hub_download(repo_id=repo_id, filename=filename)
        print(f"✅ Modelo descargado en: {MODEL_PATH}")
        break
    except Exception as e:
        print(f"⚠️  Falló {repo_id} ({type(e).__name__}). Probando el siguiente mirror...")

if MODEL_PATH is None:
    raise RuntimeError("❌ Ningún mirror funcionó. Revisa tu conexión y re-ejecuta esta celda.")
""")

# ---------- Carga del modelo ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 5 · Registrar el modelo en Ollama + cargarlo en GPU (~1-2 min)
# ═══════════════════════════════════════════════
import subprocess, requests

with open("/content/Modelfile", "w") as f:
    f.write(
        f"FROM {MODEL_PATH}\n"
        "PARAMETER num_ctx 8192\n"      # contexto: conversación + aprendizajes
        "PARAMETER temperature 0.8\n"
    )

print("🧠 Registrando el modelo en Ollama como 'myai'...")
subprocess.run(["ollama", "create", "myai", "-f", "/content/Modelfile"], check=True)
print(subprocess.run(["ollama", "list"], capture_output=True, text=True).stdout)

print("🔥 Calentando el cerebro (primera vez carga los pesos a la VRAM)...")
requests.post("http://127.0.0.1:11434/api/chat", json={
    "model": "myai",
    "messages": [{"role": "user", "content": "Di: listo"}],
    "stream": False,
    "keep_alive": -1,
    "options": {"num_predict": 5},
}, timeout=300)

print("✅ Cerebro cargado en GPU, sin censura y caliente")
""")

# ---------- Servidor ----------
code(r"""
# ═══════════════════════════════════════════════
# CELDA 6 · Servidor API (FastAPI) — traduce Ollama al contrato de MyAI
# Endpoints: /health y /chat (SSE con data: {"token": ...})
# ═══════════════════════════════════════════════
import json, time, threading
import requests as httpx_requests
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

OLLAMA_URL = "http://127.0.0.1:11434"
MODEL_NAME = "myai"

app = FastAPI(title="MyAI Brain")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    stream: bool = True
    max_tokens: int = 1024
    temperature: float = 0.8

def _ollama_payload(req: ChatRequest, stream: bool):
    return {
        "model": MODEL_NAME,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "stream": stream,
        "keep_alive": -1,   # el cerebro NUNCA se descarga de la VRAM
        "options": {
            "num_predict": req.max_tokens,
            "temperature": req.temperature,
            "num_ctx": 8192,
        },
    }

@app.get("/health")
def health():
    try:
        r = httpx_requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        ok = r.ok and any(m.get("name", "").startswith("myai") for m in r.json().get("models", []))
        if not ok:
            return {"status": "degraded", "model": None, "engine": "ollama"}
    except Exception:
        return {"status": "error", "model": None, "engine": "ollama"}
    return {
        "status": "ok",
        "model": "Llama-3-8B-Lexi-Uncensored (Q4_K_M · Ollama)",
        "engine": "ollama CUDA",
    }

@app.post("/chat")
def chat(req: ChatRequest):
    if req.stream:
        def generate():
            with httpx_requests.post(
                f"{OLLAMA_URL}/api/chat", json=_ollama_payload(req, True),
                stream=True, timeout=600,
            ) as r:
                for line in r.iter_lines():
                    if not line:
                        continue
                    obj = json.loads(line)
                    token = obj.get("message", {}).get("content", "")
                    if token:
                        yield f"data: {json.dumps({'token': token})}\n\n"
                    if obj.get("done"):
                        break
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")

    r = httpx_requests.post(f"{OLLAMA_URL}/api/chat", json=_ollama_payload(req, False), timeout=600)
    return {"content": r.json()["message"]["content"]}

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
