# Local GPU agents (Ollama) vs cloud (Claude / Cursor)

## What runs where

| Surface | Runs on | Notes |
|--------|---------|--------|
| **Cursor Chat / Agent** | Cloud models (Cursor/Claude/etc.) | Uses subscription or API credits; does **not** use your NVIDIA GPU for inference. |
| **Claude Code CLI (cloud)** | Anthropic | Same: network API, no local VRAM. |
| **Ollama** | Your machine (GPU when available on Windows with CUDA) | **This** is how you use the RTX 2050 for LLM inference locally. |

Cursor does not ship a “run the Agent on Ollama” mode. To save tokens, use a **local model** via an **OpenAI-compatible base URL** for features that support custom providers (e.g. some Chat model overrides or extensions such as Continue). Heavy agent workflows stay on cloud unless the UI explicitly supports a local OpenAI-compatible backend.

## Recommended model for ~4 GB VRAM

On this laptop, **`qwen2.5-coder:3b`** is a good fit: small, coding-oriented, and leaves headroom beside the desktop and other apps.

```powershell
ollama pull qwen2.5-coder:3b
```

Avoid loading multiple large models; one 3B Q4-class model at a time is realistic on 4 GB.

## Cursor: OpenAI-compatible local endpoint

Use Ollama’s OpenAI-compatible API (same host as `ollama serve`, default port **11434**).

**Paste these into Cursor** (exact values; adjust only if you changed the port):

| Field | Value |
|--------|--------|
| **Base URL** | `http://127.0.0.1:11434/v1` |
| **API key** | `ollama` (dummy string; many clients require a non-empty key) |
| **Model name** | `qwen2.5-coder:3b` |

Path must include **`/v1`** — that is the OpenAI-compatible prefix Ollama exposes.

Ensure Ollama is running (`ollama serve` is usually started by the Ollama app). Quick check:

```powershell
ollama ps
curl http://127.0.0.1:11434/v1/models
```

## Verify the GPU is used

After a prompt or `ollama run qwen2.5-coder:3b "..."`:

```powershell
nvidia-smi
```

You should see a process such as **`llama-server.exe`** (under Ollama’s lib folder) and **GPU memory** in use. `ollama ps` shows **`PROCESSOR ... GPU`** when the model is loaded on the GPU.

## When to use local vs cloud (save tokens)

- **Local (Ollama):** First drafts, renames, boilerplate, small refactors, comments, exploring a file — anything where speed and zero API cost matter more than perfect reasoning.
- **Claude Pro / Cursor cloud:** Money-critical code, **schema and migrations** (always verify against `supabase/migrations/`), security, complex multi-file architecture, and anything requiring the project’s full agent tooling.

## Freeing VRAM (without closing Cursor)

- Close extra browser tabs, games, or other GPU-heavy apps when you need headroom.
- Keep **one** Ollama model loaded at a time (`ollama ps`); stop runs you do not need.
- On 4 GB VRAM, **do not** run large vision models or 7B+ models unless you accept CPU fallback or OOM risk.

## Helper script

From the repo root:

```powershell
.\scripts\local-gpu-agent.ps1
```

This ensures `ollama serve` is listening if needed and prints the same paste-friendly settings.
