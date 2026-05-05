---
name: minimax-token-plan
description: Use when Hermes Agent needs MiniMax Token Plan multimodal APIs: Text to Speech HD, Hailuo-2.3 video, Hailuo-2.3-Fast video, music-2.5, music-2.6, music-cover, lyrics_generation, image-01, coding-plan-vlm, or coding-plan-search. Provides direct API endpoints, model choices, and a Node.js helper script that reads MINMAX_TOKEN_PLAN_KEY.
metadata:
  short-description: MiniMax Token Plan multimodal API helper
---

# MiniMax Token Plan

Use this skill whenever the user asks Hermes Agent to generate speech, video, music, covers, lyrics, images, image understanding, or web search through MiniMax Token Plan.

## Authentication

Use the API key from `MINMAX_TOKEN_PLAN_KEY`.

Fallback environment variables, in order:

1. `MINMAX_TOKEN_PLAN_KEY`
2. `MINIMAX_TOKEN_PLAN_KEY`
3. `MINIMAX_API_KEY`
4. `MINIMAX_CODE_PLAN_KEY`
5. `MINIMAX_CODING_API_KEY`

Default host: `https://api.minimaxi.com`.

Use `MINIMAX_API_HOST=https://api.minimax.io` only when the key was issued for the global MiniMax platform. Keep host and key region aligned.

## Fast Path

Call the bundled script from this skill directory:

```bash
node scripts/minimax-token-plan.mjs <command> [options]
```

The script uses only Node.js 18+ built-ins.

For visual generation commands (`image`, `video-t2v`, `video-i2v`), the script automatically appends a no-text rule to prompts:

`No text, no letters, no numbers, no captions, no subtitles, no logo, no watermark, no readable symbols or characters anywhere in the image or video.`

Only pass `--allow-text true` when the user explicitly requires readable text in the generated visual.

Common commands:

```bash
# Text to Speech HD, writes an MP3 from hex audio in the response.
node scripts/minimax-token-plan.mjs tts --text "你好，欢迎使用 MiniMax。" --out speech.mp3

# Long-form async TTS.
node scripts/minimax-token-plan.mjs tts-async-create --text "长文本..." --voice audiobook_male_1
node scripts/minimax-token-plan.mjs tts-async-query --task-id 123456
node scripts/minimax-token-plan.mjs file-download --file-id 123456 --out speech.mp3

# Lyrics and music.
node scripts/minimax-token-plan.mjs lyrics --prompt "一首关于夏日海边的轻快情歌"
node scripts/minimax-token-plan.mjs music --prompt "Mandopop, Summer, Lighthearted" --lyrics-file lyrics.txt --out song.mp3

# Music cover: preprocess reference audio, then pass cover_feature_id into music.
node scripts/minimax-token-plan.mjs music-cover-preprocess --audio-url "https://example.com/song.mp3"
node scripts/minimax-token-plan.mjs music --prompt "Jazz, piano, warm vocal" --lyrics-file lyrics.txt --cover-feature-id FEATURE_ID --out cover.mp3

# Image generation. No-text/no-character constraint is appended automatically.
node scripts/minimax-token-plan.mjs image --prompt "A cinematic robot gardener at dawn" --aspect-ratio 16:9 --n 2 --out-dir images

# Video generation. Creation is async and returns task_id. No-text/no-character constraint is appended automatically.
node scripts/minimax-token-plan.mjs video-t2v --prompt "A tiny robot waters a plant [固定]" --model MiniMax-Hailuo-2.3 --duration 6 --resolution 768P
node scripts/minimax-token-plan.mjs video-i2v --prompt "The cube slowly rotates [固定]" --image-file images/photo.jpeg --model MiniMax-Hailuo-2.3-Fast
node scripts/minimax-token-plan.mjs video-query --task-id TASK_ID
node scripts/minimax-token-plan.mjs video-download --file-id FILE_ID --out video.mp4

# Coding Plan search and VLM.
node scripts/minimax-token-plan.mjs search --query "MiniMax Token Plan latest model list" --count 5
node scripts/minimax-token-plan.mjs vlm --prompt "Describe this image" --image-file images/photo.jpeg
```

## API Map

Use Bearer authentication and JSON request bodies unless noted.

| Capability | Model | Endpoint | Notes |
| --- | --- | --- | --- |
| Text to Speech HD | `speech-2.8-hd` by default | `POST /v1/t2a_v2` | Synchronous TTS. For long text use async. |
| Async Text to Speech HD | `speech-2.8-hd` by default | `POST /v1/t2a_async_v2`, `GET /v1/query/t2a_async_query_v2?task_id=...` | Download completed audio through file retrieval. |
| Music generation | `music-2.6` | `POST /v1/music_generation` | Sends `prompt`, `lyrics`, and optional `cover_feature_id`. |
| Legacy/explicit music generation | `music-2.5` | `POST /v1/music_generation` | Same command as music; only use when the user explicitly asks for `music-2.5` or wants to spend that quota. |
| Music cover preprocess | `music-cover` | `POST /v1/music_cover_preprocess` | Sends one of `audio_url` or `audio_base64`; returns `cover_feature_id`. |
| Lyrics generation | n/a | `POST /v1/lyrics_generation` | Modes: `write_full_song`, `edit`. |
| Image generation | `image-01` | `POST /v1/image_generation` | Supports text-to-image and subject reference image-to-image. |
| Text-to-video | `MiniMax-Hailuo-2.3` | `POST /v1/video_generation` | Async task. Defaults to standard 768P 6s. |
| Image-to-video | `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-2.3` | `POST /v1/video_generation` | Async task with `first_frame_image`. Defaults to Fast 768P 6s. Supports URL or local image file. |
| Video task status | n/a | `GET /v1/query/video_generation?task_id=...` | Poll until `status` is `Success`, then use `file_id`. |
| Video download | n/a | `GET /v1/files/retrieve?file_id=...` | Returns `download_url`; the script can save it to `--out`. |
| Coding Plan search | `coding-plan-search` | `POST /v1/coding_plan/search` | Payload uses `q`; `count` is a client-side trim. |
| Coding Plan VLM | `coding-plan-vlm` | `POST /v1/coding_plan/vlm` | Payload uses `prompt` and a data URL in `image_url`; the script converts `--image-url` or `--image-file` automatically. |

## Model Router

Use this table to choose the correct MiniMax model or capability from a user request.

| User intent | Use | Do not use when | Input | Output |
| --- | --- | --- | --- | --- |
| Turn text into natural spoken audio, voiceover, narration, dialogue, audiobook snippets, product demos, or Chinese/English speech | Text to Speech HD with model `speech-2.8-hd` through `tts` | The user wants singing, background music, lyrics, or image/video generation | Plain text, optional voice/speed/format | MP3/WAV/etc audio |
| Turn long text, chapters, articles, or book passages into speech where synchronous TTS may time out | Async Text to Speech HD with model `speech-2.8-hd` through `tts-async-create` and `tts-async-query` | The text is short enough for normal `tts`, or the user needs immediate inline audio | Long plain text, voice settings | Task ID, then downloadable audio file |
| Write song lyrics from an idea, theme, genre, title, mood, or partial lyric draft | `lyrics_generation` through `lyrics` | The user already has finished lyrics and only needs audio/music | Prompt, optional title, optional lyrics for edit mode | Song title, style tags, lyrics |
| Generate a full song or instrumental-style music from lyrics and style prompt | `music-2.6` through `music` | The user only wants spoken narration/TTS, only lyrics, or an image | Style prompt plus lyrics | MP3 audio or URL/hex audio |
| Generate music with the older/lower daily-quota model because the user explicitly named it | `music-2.5` through `music --model music-2.5` | The user just says "music" without specifying model; default to `music-2.6` | Style prompt plus lyrics | MP3 audio or URL/hex audio |
| Create a cover-style music generation using the vocal/style characteristics of reference audio | `music-cover` preprocessing, then `music-2.6` with `cover_feature_id` | Reference audio is shorter than 6 seconds, longer than 360 seconds, unavailable, or the user only wants normal music generation | Reference audio URL/file, then lyrics and style prompt | `cover_feature_id`, then generated cover audio |
| Generate still images, concept art, illustrations, product visuals, thumbnails, covers, icons, or prompt-based visual assets | `image-01` through `image` | The user asks to understand an existing image rather than create one, or asks for video | Text prompt, optional aspect ratio/count/reference image | Image URL or local JPEG/PNG/WebP |
| Generate a 6s 768P video from only a text prompt | `MiniMax-Hailuo-2.3` through `video-t2v` | The user provides a first-frame image or asks for Fast image animation | Prompt | Async `task_id`, then MP4 |
| Animate an image into a 6s 768P video quickly or cheaply | `MiniMax-Hailuo-2.3-Fast` through `video-i2v` | The user explicitly requests standard/non-Fast Hailuo, or gives no image | Prompt plus first-frame image | Async `task_id`, then MP4 |
| Generate image-to-video with the standard Hailuo 2.3 model | `MiniMax-Hailuo-2.3` through `video-i2v --model MiniMax-Hailuo-2.3` | The user asks for Fast, cheapest, quickest, or wants to preserve standard quota | Prompt plus first-frame image | Async `task_id`, then MP4 |
| Search the live web for current facts, recent news, links, official docs, product info, or external references | `coding-plan-search` through `search` | The answer can be produced from local context or no current/live information is needed | Search query | Search results with title/link/snippet/date |
| Understand, describe, OCR, inspect, or debug an existing image/screenshot/chart/UI/photo | `coding-plan-vlm` through `vlm` | The user asks to generate a new image, or the image is already fully described in the conversation | Prompt plus local image file or image URL | Text analysis/description |

## Decision Rules

- If the user says "read", "speak", "voice", "配音", "朗读", "旁白", or "audiobook", choose Text to Speech HD.
- If the user says "song", "music", "compose", "beat", "唱歌", "歌曲", or "配乐", choose `music-2.6`; if lyrics are missing, call `lyrics_generation` first.
- If the user explicitly says `music-2.5`, choose `music --model music-2.5`; otherwise do not spend the smaller `music-2.5` quota.
- If the user says "cover", "翻唱", "use this reference audio", or "imitate this song/vocal style", choose `music-cover` preprocessing before `music-2.6`.
- If the user says "lyrics", "write a chorus", "作词", or "歌词", choose `lyrics_generation`.
- If the user says "generate image", "draw", "poster", "cover art", "logo", "插图", or "图片生成", choose `image-01`.
- For every `image-01` prompt, enforce no visible text/letters/numbers/captions/subtitles/logos/watermarks/readable symbols unless the user explicitly asks for readable text.
- If the user says "video", "短视频", "文生视频", or "生成视频" with only text, choose `video-t2v` using `MiniMax-Hailuo-2.3`, `duration=6`, `resolution=768P`.
- If the user says "图生视频", "animate", "make this image move", or provides a starting image for video, choose `video-i2v` using `MiniMax-Hailuo-2.3-Fast`, `duration=6`, `resolution=768P`.
- If the user explicitly asks for "standard", "non-fast", "higher quality", `Hailuo-2.3`, or `MiniMax-Hailuo-2.3` for image-to-video, choose `MiniMax-Hailuo-2.3` instead of Fast.
- For every video prompt, enforce no visible text/letters/numbers/captions/subtitles/logos/watermarks/readable symbols unless the user explicitly asks for readable text.
- If the user provides an existing image/screenshot and asks what it contains, what is wrong, to extract text, or to analyze UI/diagram/chart content, choose `coding-plan-vlm`.
- If the user asks for latest/current/live information, source links, public facts, API docs, news, or external research, choose `coding-plan-search`.
- For multi-step creative tasks, chain models: `lyrics_generation` -> `music-2.6`, `music-cover` -> `music-2.6`, `image-01` -> `coding-plan-vlm` for self-checking, or `image-01` -> `video-i2v` to animate a generated image.

## Per-Model Notes

### Text to Speech HD

Purpose: high-quality spoken audio from text.

Use for:

- Short voice clips, narration, dialogue, podcast intros, audiobook samples, app voice prompts.
- Chinese or English speech where natural pronunciation matters.

Command:

```bash
node scripts/minimax-token-plan.mjs tts --text "要朗读的文本" --out speech.mp3
```

### Async Text to Speech HD

Purpose: long-form text-to-speech jobs.

Use for:

- Chapters, long articles, scripts, and batch audiobook generation.

Commands:

```bash
node scripts/minimax-token-plan.mjs tts-async-create --text-file chapter.txt
node scripts/minimax-token-plan.mjs tts-async-query --task-id TASK_ID
node scripts/minimax-token-plan.mjs file-download --file-id FILE_ID --out chapter.mp3
```

### lyrics_generation

Purpose: create or edit song lyrics.

Use for:

- Turning a theme, title, mood, or story premise into structured lyrics.
- Preparing lyrics before `music-2.6`.

Command:

```bash
node scripts/minimax-token-plan.mjs lyrics --prompt "一首关于夏天和代码的轻快副歌"
```

### music-2.6

Purpose: generate complete music audio.

Use for:

- Songs, jingles, BGM, music demos, vocal tracks based on lyrics and style prompt.

Command:

```bash
node scripts/minimax-token-plan.mjs music --prompt "Pop, cheerful, short jingle" --lyrics-file lyrics.txt --out song.mp3
```

### music-2.5

Purpose: older/explicit music generation model with separate Token Plan quota.

Use for:

- Only when the user explicitly requests `music-2.5`.
- Spending the `music-2.5` daily quota intentionally while preserving `music-2.6`.

Avoid for:

- Normal music requests; default to `music-2.6`.

Command:

```bash
node scripts/minimax-token-plan.mjs music --model music-2.5 --prompt "Pop, cheerful, short jingle" --lyrics-file lyrics.txt --out song.mp3
```

### music-cover

Purpose: extract cover/reference features from existing audio, then use them in music generation.

Use for:

- Cover-like generation from a reference audio file or URL.
- Reference audio must be 6-360 seconds.

Commands:

```bash
node scripts/minimax-token-plan.mjs music-cover-preprocess --audio-file reference.mp3
node scripts/minimax-token-plan.mjs music --prompt "Jazz ballad" --lyrics-file lyrics.txt --cover-feature-id FEATURE_ID --out cover.mp3
```

### image-01

Purpose: generate still images from prompts.

Use for:

- Illustrations, posters, cover art, concept images, product visuals, thumbnails.

Prompt rule:

- Always avoid visible text, letters, numbers, captions, subtitles, logos, watermarks, and readable symbols.
- The script appends this restriction automatically. Use `--allow-text true` only when the user explicitly requires readable text.

Command:

```bash
node scripts/minimax-token-plan.mjs image --prompt "a tiny blue cube on a white table" --aspect-ratio 1:1 --out-dir images
```

### Hailuo-2.3-Fast 768P 6s

Purpose: fast/default 6-second 768P image-to-video generation.

API model name: `MiniMax-Hailuo-2.3-Fast`.

Use for:

- Quick image-to-video generations.
- Requests to animate an existing/generated still image.
- Token Plan quota item `Hailuo-2.3-Fast-768P 6s`.

Prompt rule:

- Always avoid visible text, letters, numbers, captions, subtitles, logos, watermarks, and readable symbols in the video.
- The script appends this restriction automatically. Use `--allow-text true` only when the user explicitly requires readable text.

Avoid for:

- Requests that explicitly ask for standard/non-Fast Hailuo 2.3.
- Prompt-only text-to-video requests; use `MiniMax-Hailuo-2.3` for those.

Commands:

```bash
node scripts/minimax-token-plan.mjs video-i2v --prompt "The scene comes alive [固定]" --image-file start.jpeg --model MiniMax-Hailuo-2.3-Fast --duration 6 --resolution 768P
node scripts/minimax-token-plan.mjs video-query --task-id TASK_ID
node scripts/minimax-token-plan.mjs video-download --file-id FILE_ID --out video.mp4
```

### Hailuo-2.3 768P 6s

Purpose: standard Hailuo 2.3 text-to-video and image-to-video generation.

API model name: `MiniMax-Hailuo-2.3`.

Use for:

- Text-to-video from prompt only.
- User explicitly asks for `Hailuo-2.3`, "standard", or "non-fast".
- User prefers quality/instruction following over fastest generation.
- Token Plan quota item `Hailuo-2.3-768P 6s`.

Prompt rule:

- Always avoid visible text, letters, numbers, captions, subtitles, logos, watermarks, and readable symbols in the video.
- The script appends this restriction automatically. Use `--allow-text true` only when the user explicitly requires readable text.

Command:

```bash
node scripts/minimax-token-plan.mjs video-t2v --prompt "A cinematic city street after rain [推进]" --model MiniMax-Hailuo-2.3 --duration 6 --resolution 768P
```

### Video Task Query And Download

Purpose: complete the async video workflow.

Use for:

- Polling a `task_id` returned by `video-t2v` or `video-i2v`.
- Downloading the final MP4 after the query returns `status: "Success"` and `file_id`.

Commands:

```bash
node scripts/minimax-token-plan.mjs video-query --task-id TASK_ID
node scripts/minimax-token-plan.mjs video-download --file-id FILE_ID --out output.mp4
```

### coding-plan-search

Purpose: live web search through MiniMax Coding Plan.

Use for:

- Current facts, official docs, source discovery, news, public web research.

Command:

```bash
node scripts/minimax-token-plan.mjs search --query "MiniMax latest API docs" --count 5
```

### coding-plan-vlm

Purpose: understand existing images.

Use for:

- Screenshots, UI review, OCR, chart/photo interpretation, visual debugging.
- Prefer `--image-file` for local files; the script converts it to the data URL format MiniMax expects.

Command:

```bash
node scripts/minimax-token-plan.mjs vlm --prompt "Describe this image briefly" --image-file screenshot.png
```

## Defaults

- TTS model: `speech-2.8-hd`
- TTS voice: `male-qn-qingse` for sync, `audiobook_male_1` for async
- TTS format: `mp3`, sample rate `32000`, bitrate `128000`
- Music model: `music-2.6`
- Explicit legacy music model: `music-2.5`
- Music output: `hex` decoded to `--out` when provided
- Image model: `image-01`
- Image response format: `base64` when saving locally, `url` otherwise
- Image aspect ratio: `1:1`
- Text-to-video model: `MiniMax-Hailuo-2.3`
- Image-to-video model: `MiniMax-Hailuo-2.3-Fast`
- Video duration/resolution: `6` seconds, `768P`
- Visual prompt constraint: no visible text, letters, numbers, captions, subtitles, logos, watermarks, or readable symbols by default

## Workflow Guidance

Before calling an API, verify the requested modality and output format:

- For short narration or voice snippets, use `tts`.
- For long text, books, or chapters, use `tts-async-create`, poll with `tts-async-query`, then `file-download`.
- For songs, call `lyrics` first when lyrics are missing, then pass the returned lyrics to `music`.
- For covers, run `music-cover-preprocess` on the reference audio and pass the returned `cover_feature_id` to `music`.
- For image generation, use `image` and request `url` unless the user needs local files.
- For video generation, use `video-t2v` with `MiniMax-Hailuo-2.3` for prompt-only video and `video-i2v` with `MiniMax-Hailuo-2.3-Fast` for first-frame image animation; poll with `video-query`, then save with `video-download`.
- For image/video generation, keep prompts visual-only and avoid requesting any text rendering unless the user explicitly asks for it.
- For live information search, use `search`.
- For image understanding, use `vlm`.

## Official References

- MiniMax Token Plan overview: `https://platform.minimaxi.com/docs/coding-plan/intro`
- MiniMax API overview: `https://platform.minimaxi.com/docs/api-reference/api-overview`
- TTS HTTP: `https://platform.minimaxi.com/docs/api-reference/speech-t2a-http`
- TTS async: `https://platform.minimaxi.com/docs/api-reference/speech-t2a-async-create`
- Image generation: `https://platform.minimaxi.com/docs/api-reference/image-generation-t2i`
- Video generation overview: `https://platform.minimaxi.com/docs/api-reference/video-generation-intro`
- Text-to-video: `https://platform.minimaxi.com/docs/api-reference/video-generation-t2v`
- Image-to-video: `https://platform.minimaxi.com/docs/api-reference/video-generation-i2v`
- Video task query: `https://platform.minimaxi.com/docs/api-reference/video-generation-query`
- Video download: `https://platform.minimaxi.com/docs/api-reference/video-generation-download`
- Music generation: `https://platform.minimaxi.com/docs/api-reference/music-generation`
- Lyrics generation: `https://platform.minimaxi.com/docs/api-reference/lyrics-generation`
- Music cover preprocess: `https://platform.minimaxi.com/docs/api-reference/music-cover-preprocess`
