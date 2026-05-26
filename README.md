# My pi configuration

This repository contains the configuration files for the **Pi** agent that I use in my local development environment (`~/.pi`). Feel free to browse, copy snippets, or adapt the setup for your own use. Keep in mind that this setup is tailored to my workflow and may need adjustments for yours.

## Getting started

1. **Export API keys** – Pi reads credentials from environment variables. If you have API keys from verious providers, add the following lines to your shell startup file (`~/.zshrc`, `~/.bashrc`, …) and replace the placeholder values with your actual keys:

```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
export OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
```

Note: Both Gemini and OpenRouter have a free tier (as of May 2026).
