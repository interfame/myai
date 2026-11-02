# 🧠 MyAI — Plataforma de IA Libre, Evolutiva y Sin Censura

Tu propia IA personal con **Llama-3-8B-Uncensored** corriendo gratis en Google Colab,
memoria infinita evolutiva (aprende sola de cada conversación) y automatización total
con GitHub Actions. **Costo de mantenimiento: $0.**

![arquitectura](https://img.shields.io/badge/cerebro-Llama--3--8B--Uncensored-black) ![colab](https://img.shields.io/badge/Colab-T4%20GRATIS-emerald) ![license](https://img.shields.io/badge/uso-personal-green)

---

## 🏗️ Arquitectura del ecosistema

```
┌──────────────────────────────────────────────────────────────┐
│  PLATAFORMA MYAI (Next.js — este repo)                       │
│  · Chat web con streaming en tiempo real                     │
│  · Ajustes: cerebro, personalidad, secretos                  │
│  · Memoria: aprendizajes guardados y editables               │
│  Deploy: Netlify / Vercel / VPS                              │
└──────────────┬───────────────────────────────┬───────────────┘
               │ POST /api/chat (SSE)          │ SQLite / Supabase
               ▼                               ▼
┌──────────────────────────────┐   ┌─────────────────────────┐
│  CEREBRO (Google Colab T4)   │   │  MEMORIA                │
│  colab/myai_brain.ipynb      │   │  · Conversaciones       │
│  Llama-3-8B-Lexi-Uncensored  │   │  · Mensajes             │
│  GGUF Q4_K_M · Ollama     │   │  · APRENDIZAJES (auto)  │
│  FastAPI + túnel cloudflared │   │  · Ajustes del robot    │
└──────────────▲───────────────┘   └─────────────────────────┘
               │ auto-registro de túnel
┌──────────────┴───────────────────────────────────────────────┐
│  GITHUB ACTIONS (keep-alive cada 20 min)                     │
│  Pinge plataforma + cerebro → nada se duerme                 │
└──────────────────────────────────────────────────────────────┘
```

## 🧬 El bucle de aprendizaje automático (memoria infinita)

1. **Hablas** con MyAI desde la web.
2. **La IA evalúa**: al terminar cada respuesta, un módulo de auto-evaluación analiza
   el intercambio y extrae lo valioso y duradero — ej: *"El Jefe prefiere que lo
   saluden diciendo 'Hola Jefe'"* — y lo guarda en la tabla `Learning`.
3. **Deduplicación inteligente**: si el aprendizaje ya existía, se **refuerza**
   (sube su `strength`) en lugar de duplicarse.
4. **Auto-consulta**: en la próxima charla, el backend inyecta los 30 aprendizajes
   más fuertes directamente en el system prompt del cerebro **antes de que empiece
   a hablar**. La IA recuerda cosas nuevas de forma automática. ♻️

También puedes añadir aprendizajes a mano en **Ajustes → Memoria**.

## 🚀 Puesta en marcha (10 minutos)

### Paso 1 — La plataforma
```bash
git clone https://github.com/interfame/myai.git
cd myai
npm install
cp .env.example .env        # SQLite local ya funciona así
npx prisma db push
npm run dev                 # → http://localhost:3000
```
La plataforma ya funciona con un **cerebro de respaldo** integrado, incluso sin Colab.

### Paso 2 — El cerebro en Colab
1. Sube (o abre desde el repo) `colab/myai_brain.ipynb` a [Google Colab](https://colab.research.google.com)
2. `Entorno de ejecución → Cambiar tipo de entorno → T4 GPU`
3. En la **Celda 2** rellena:
   - `PLATFORM_URL` → la URL pública de tu plataforma (ej: `https://myai.netlify.app`)
   - `REGISTRATION_SECRET` → el mismo que pondrás en la plataforma (Ajustes → Cerebro)
4. `Ejecutar todo` → espera la línea **🌐 URL PÚBLICA DEL CEREBRO**
5. La plataforma se registra **sola** (auto-registro vía `/api/tunnel/register`).
   Si lo prefieres a mano: copia la URL en **Ajustes → Cerebro**.

### Paso 3 — Automatización (GitHub Actions)
En `Settings → Secrets and variables → Actions` de este repo:
- **Secret** `MYAI_PLATFORM_URL` = URL de tu plataforma
- **Variable** `MYAI_BRAIN_URL` = URL del túnel que imprime el notebook

El workflow `keep-alive.yml` pingüea cada 20 min para que nada se duerma. 💓

## 🗄️ Memoria persistente con Supabase (opcional, recomendado en producción)

- **Vía Prisma** (1 cambio): en `prisma/schema.prisma` cambia `provider = "postgresql"`
  y usa la connection string de Supabase en `DATABASE_URL`. Luego `npx prisma db push`.
- **Vía SQL directa**: pega `supabase/schema.sql` en el SQL Editor de Supabase.

## 📡 API de la plataforma

| Endpoint | Descripción |
|---|---|
| `POST /api/chat` | Chat con streaming SSE + auto-aprendizaje |
| `GET /api/health` | Estado de plataforma y cerebro (latencia, modelo) |
| `GET/PUT /api/settings` | Cerebro, personalidad, auto-aprendizaje |
| `GET /api/conversations` · `GET/DELETE /api/conversations/{id}` | Historial |
| `GET/POST /api/learnings` · `PATCH/DELETE /api/learnings/{id}` | Memoria evolutiva |
| `POST /api/learn/extract` | Análisis manual de una conversación |
| `POST /api/tunnel/register` | Auto-registro del cerebro Colab (CORS abierto) |

## 🛡️ Notas importantes

- **Colab Free**: sesiones de ~12h máx. Si se desconecta, re-ejecuta el notebook
  (2-3 min) → el túnel nuevo se auto-registra y la plataforma sigue sola.
- **Seguridad del túnel**: usa siempre el `REGISTRATION_SECRET` para que nadie más
  conecte cerebros a tu plataforma.
- **Uso responsable**: "sin censura" significa sin filtros corporativos; el prompt
  por defecto mantiene un único límite innegociable (daño grave a personas reales),
  y es editable desde Ajustes. Tú eres responsable de lo que haces con tu IA.

---

Hecho con 🖤 y cero censura corporativa · [github.com/interfame/myai](https://github.com/interfame/myai)
