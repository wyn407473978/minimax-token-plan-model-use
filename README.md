# MiniMax Token Plan Hermes Skill

This repository contains a Hermes/Codex Skill for using MiniMax Token Plan models:

- Text to Speech HD
- `music-2.6`
- `music-cover`
- `lyrics_generation`
- `image-01`
- `coding-plan-vlm`
- `coding-plan-search`

## Install

Copy the skill directory into the Hermes skills directory:

```bash
mkdir -p ~/.hermes/skills
cp -R minimax-token-plan ~/.hermes/skills/minimax-token-plan
```

If your Hermes setup uses another skill directory, copy `minimax-token-plan/` there instead.

## Required Environment Variable

Before using the skill, configure the MiniMax Token Plan API key:

```bash
export MINMAX_TOKEN_PLAN_KEY="your_api_key"
```

To persist it for zsh:

```bash
echo 'export MINMAX_TOKEN_PLAN_KEY="your_api_key"' >> ~/.zshrc
source ~/.zshrc
```

The helper script also accepts these fallback names, but `MINMAX_TOKEN_PLAN_KEY` is preferred:

- `MINIMAX_TOKEN_PLAN_KEY`
- `MINIMAX_API_KEY`
- `MINIMAX_CODE_PLAN_KEY`
- `MINIMAX_CODING_API_KEY`

## Check Setup

Verify the key is visible:

```bash
test -n "$MINMAX_TOKEN_PLAN_KEY" && echo "MiniMax key configured" || echo "Missing MINMAX_TOKEN_PLAN_KEY"
```

Verify the script:

```bash
node minimax-token-plan/scripts/minimax-token-plan.mjs help
```

Run a low-cost live check:

```bash
node minimax-token-plan/scripts/minimax-token-plan.mjs search --query MiniMax --count 1
```

If the key is missing, the script will stop and remind you to set `MINMAX_TOKEN_PLAN_KEY`.

## Examples

```bash
# Text to speech
node minimax-token-plan/scripts/minimax-token-plan.mjs tts --text "MiniMax test." --out speech.mp3

# Image generation
node minimax-token-plan/scripts/minimax-token-plan.mjs image --prompt "a tiny blue cube on a white table" --out-dir images

# Search
node minimax-token-plan/scripts/minimax-token-plan.mjs search --query "MiniMax API docs" --count 5

# Image understanding
node minimax-token-plan/scripts/minimax-token-plan.mjs vlm --prompt "Describe this image" --image-file images/image-1.jpeg
```

## Files

- `minimax-token-plan/SKILL.md`: model routing and usage instructions for Hermes Agent.
- `minimax-token-plan/scripts/minimax-token-plan.mjs`: Node.js helper for MiniMax API calls.
- `minimax-token-plan/agents/openai.yaml`: skill metadata.
