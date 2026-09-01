# My pi configuration

This repository contains the configuration files for the **Pi** agent that I use in my local development environment (`~/.pi`). Feel free to browse, copy snippets, or adapt the setup for your own use. Keep in mind that this setup is tailored to my workflow and may need adjustments for yours.

## Getting started

1. **Export API keys** – Pi reads credentials from environment variables. If you have API keys from verious providers, add the following lines to your shell startup file (`~/.zshrc`, `~/.bashrc`, …) and replace the placeholder values with your actual keys:

```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
export OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
```

Note: Both Gemini and OpenRouter have a free tier (as of May 2026).

## llama-server command

This is the llama-server command that I use when running Qwen3.8 locally on my Macbook M4 Max with 64GB of RAM.

```sh
llama serve -m ~/.models/Qwen3.8-27B-UD-Q5_K_XL.gguf -ngl 99 -fa on -c 262144 -ctk q4_0 -ctv q4_0 -t 12 --load-mode mlock --jinja
```

## mlx_lm.server command

This is the mlx_lm.server command that I use when running Qwen3.8 locally on my Macbook M4 Max with 64GB of RAM.

```sh
MLX_MALLOC_LARGE_ALLOCATIONS_ONLY=1 mlx_lm.server --model mlx-community/Qwen3.8-27B-4bit --max-kv-size 262144 --max-tokens 8192 --kv-bits 4
```
