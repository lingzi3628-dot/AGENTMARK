# 🦙 Using Local Models with AGENTMARK

AGENTMARK supports running AI agents with **100% free, local models** — no API keys, no cloud costs, complete privacy. Your data never leaves your machine.

## Supported Local Model Runners

| Runner | Best for | Default Port | Install |
|---|---|---|---|
| [**Ollama**](https://ollama.ai) | Easiest setup, most popular | 11434 | `curl -fsSL https://ollama.ai/install.sh \| sh` |
| [**LM Studio**](https://lmstudio.ai) | GUI app, model browser | 1234 | Download from lmstudio.ai |
| [**Jan**](https://jan.ai) | Open-source GUI, cross-platform | 1337 | Download from jan.ai |
| [**llama.cpp**](https://github.com/ggerganov/llama.cpp) | Maximum performance, CLI | 8080 | Build from source |

All of these expose an **OpenAI-compatible API**, so AGENTMARK can connect to them just like any cloud provider.

---

## 🚀 Quick Start with Ollama (Recommended)

### Step 1: Install Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:** Download from [ollama.ai](https://ollama.ai)

### Step 2: Pull a model

```bash
# Fast + capable (recommended)
ollama pull llama3.2

# Or try other models:
ollama pull mistral      # Mistral 7B
ollama pull qwen2.5      # Qwen 2.5
ollama pull phi3         # Microsoft Phi-3 (small + fast)
ollama pull codellama    # Code-focused
ollama pull llava        # Vision-capable
```

### Step 3: Verify Ollama is running

```bash
# Ollama auto-starts on port 11434
curl http://localhost:11434/v1/models
```

You should see a JSON response listing your downloaded models.

### Step 4: Add Ollama to AGENTMARK

1. Open AGENTMARK → **Settings** → **Custom API Keys**
2. Click **Add Key**
3. Fill in:
   - **Label:** `My Ollama`
   - **Provider:** Select `🦙 Ollama (Local)`
   - Base URL + Model name auto-fill ✅
   - **API Key:** Enter `local` (any value works — Ollama doesn't check)
4. Click **Save Key**

### Step 5: Use the local model in your agents

1. Open an agent in the **Studio**
2. Click on a **Language Model** node
3. In the Inspector panel, set **Provider** to `custom`
4. Set **API URL** to `http://localhost:11434/v1`
5. Set **Model Name** to `llama3.2` (or whichever model you pulled)
6. Set **API Key** to `local`
7. Run your agent — it's now using a local model! 🎉

---

## 🖥️ Using LM Studio

1. Download + install [LM Studio](https://lmstudio.ai)
2. Open LM Studio → search for a model (e.g. "Llama 3.2 3B GGUF")
3. Download the model
4. Go to the **Local Server** tab → click **Start Server**
5. In AGENTMARK Settings → Add Key → Provider: `🖥️ LM Studio (Local)`
6. Base URL auto-fills to `http://localhost:1234/v1`
7. Done!

---

## 🔒 Privacy & Security

When you use local models:
- ✅ **No data leaves your computer** — all inference happens locally
- ✅ **No API costs** — completely free
- ✅ **No rate limits** — run as many agents as your hardware supports
- ✅ **Works offline** — no internet connection needed after model download

---

## ⚡ Performance Tips

| Hardware | Recommended Models |
|---|---|
| **8GB RAM** | `phi3` (mini), `qwen2.5:1.5b` |
| **16GB RAM** | `llama3.2`, `mistral`, `qwen2.5:7b` |
| **32GB RAM** | `llama3.1:8b`, `codellama:13b` |
| **64GB+ RAM / GPU** | `llama3.1:70b`, `qwen2.5:32b` |

### GPU Acceleration

- **Ollama** auto-detects NVIDIA GPUs + Apple Silicon (M1/M2/M3)
- **LM Studio** has GPU settings in the UI
- **llama.cpp** supports CUDA, Metal, ROCm, Vulkan

---

## 🐛 Troubleshooting

### "Connection refused" error
- Make sure Ollama is running: `ollama serve`
- Check the port: `curl http://localhost:11434/v1/models`
- If using Docker, use `http://host.docker.internal:11434/v1` instead of `localhost`

### "Model not found" error
- List available models: `ollama list`
- Make sure you pulled the model: `ollama pull llama3.2`

### Slow responses
- Try a smaller model (`phi3` instead of `llama3.2`)
- Enable GPU acceleration
- Close other memory-intensive apps

### Out of memory
- Use a smaller model
- Reduce the context window in the node settings
- Close other applications

---

## 🆚 Local vs Cloud Models

| Feature | Local Models | Cloud Models (GLM, OpenAI) |
|---|---|---|
| Cost | ✅ Free | ❌ Pay per token |
| Privacy | ✅ 100% private | ❌ Data sent to cloud |
| Speed | ⚠️ Depends on hardware | ✅ Fast (optimized infra) |
| Quality | ⚠️ Smaller models = lower quality | ✅ Best models available |
| Offline | ✅ Works offline | ❌ Requires internet |
| Setup | ⚠️ Need to install + pull models | ✅ Just add API key |

**Recommendation:** Use local models for development, testing, and privacy-sensitive use cases. Switch to cloud models (GLM-4.6, GPT-4o) for production when you need the best quality.

---

## 💡 Need Help?

- 🐛 [Report an issue](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- 📖 [Ollama docs](https://github.com/ollama/ollama)
- 📖 [LM Studio docs](https://lmstudio.ai/docs)

Happy building with local models! 🦙
