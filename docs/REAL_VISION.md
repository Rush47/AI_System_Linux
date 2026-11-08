# Real Vision — Ollama + OpenAI fallback

## Usage
```bash
ollama pull llama3.2-vision:11b
export OLLAMA_URL=http://127.0.0.1:11434
python3 deploy/host-worker/real_vision.py ./photo.jpg --prompt "Co widać na zdjęciu?"
```

By default the image stays local and only Ollama is called. If Ollama fails, the command exits with an error. To **opt in** to uploading image data to OpenAI as fallback:

```bash
export VISION_OPENAI_FALLBACK=true
export OPENAI_API_KEY='set-in-your-secret-manager'
export OPENAI_VISION_MODEL=gpt-4.1-mini
python3 deploy/host-worker/real_vision.py ./photo.jpg
```

Never commit real keys. OpenAI API is billed separately from ChatGPT subscriptions. OpenAI model access varies by account. Local Ollama requires a running vision-capable model and sufficient RAM/VRAM. `OPENAI_API_BASE` is configurable only for operator-managed endpoints. Supported inputs: PNG, JPEG, WEBP, GIF (up to 10MB). No automated camera capture or background watching is enabled.

## Current state
This is a working adapter source added to GitHub, **not yet integrated into Control Center's upload UI or original agents**. It has not been executed against a running Ollama/OpenAI instance. For production, add authenticated file-upload API, audit logging, image retention, rate limiting, and event broadcasting.
