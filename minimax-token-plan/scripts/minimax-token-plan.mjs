#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const DEFAULT_HOST = "https://api.minimaxi.com";

const COMMANDS = new Set([
  "tts",
  "tts-async-create",
  "tts-async-query",
  "file-download",
  "lyrics",
  "music",
  "music-cover-preprocess",
  "image",
  "video-t2v",
  "video-i2v",
  "video-query",
  "video-download",
  "search",
  "vlm",
  "raw",
  "help",
]);

function usage() {
  console.log(`MiniMax Token Plan helper

Usage:
  node scripts/minimax-token-plan.mjs <command> [options]

Commands:
  tts                    Sync Text to Speech HD. Options: --text, --text-file, --out, --voice, --model
  tts-async-create       Create async TTS task. Options: --text, --text-file, --voice, --model
  tts-async-query        Query async TTS task. Options: --task-id
  file-download          Download file content. Options: --file-id, --out
  lyrics                 Generate lyrics. Options: --prompt, --mode, --lyrics, --lyrics-file, --title
  music                  Generate music. Options: --prompt, --lyrics, --lyrics-file, --out, --model, --cover-feature-id
  music-cover-preprocess Preprocess cover reference. Options: --audio-url or --audio-file
  image                  Generate images. Options: --prompt, --out-dir, --aspect-ratio, --n, --response-format, --allow-text
  video-t2v              Create text-to-video task. Options: --prompt, --model, --duration, --resolution, --allow-text
  video-i2v              Create image-to-video task. Options: --prompt, --image-url or --image-file, --model, --duration, --resolution, --allow-text
  video-query            Query video task. Options: --task-id
  video-download         Retrieve and download video file. Options: --file-id, --out
  search                 Coding Plan search. Options: --query, --count
  vlm                    Coding Plan VLM. Options: --prompt, --image-url or --image-file
  raw                    Raw JSON POST/GET. Options: --method, --path, --json

Env:
  MINMAX_TOKEN_PLAN_KEY is preferred.
  MINIMAX_API_HOST defaults to ${DEFAULT_HOST}.
`);
}

function parseArgs(argv) {
  const args = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const eq = token.indexOf("=");
    if (eq > -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { args, positionals };
}

function key() {
  const value =
    process.env.MINMAX_TOKEN_PLAN_KEY ||
    process.env.MINIMAX_TOKEN_PLAN_KEY ||
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_CODE_PLAN_KEY ||
    process.env.MINIMAX_CODING_API_KEY;
  if (!value) {
    throw new Error(
      "Missing MiniMax API key. Please set MINMAX_TOKEN_PLAN_KEY before using this skill, for example: export MINMAX_TOKEN_PLAN_KEY=\"your_api_key\"",
    );
  }
  return value;
}

function host() {
  return (process.env.MINIMAX_API_HOST || DEFAULT_HOST).replace(/\/+$/, "");
}

async function textFromArgs(args) {
  if (args.text !== undefined) return String(args.text);
  if (args["text-file"]) return readFile(String(args["text-file"]), "utf8");
  throw new Error("Provide --text or --text-file.");
}

async function lyricsFromArgs(args) {
  if (args.lyrics !== undefined) return String(args.lyrics);
  if (args["lyrics-file"]) return readFile(String(args["lyrics-file"]), "utf8");
  throw new Error("Provide --lyrics or --lyrics-file.");
}

function mimeFromPath(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function mimeFromContentType(value, fallback = "image/jpeg") {
  if (!value) return fallback;
  const type = String(value).split(";")[0].trim().toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(type)) return type;
  return fallback;
}

function intArg(args, name, fallback) {
  if (args[name] === undefined) return fallback;
  const value = Number.parseInt(String(args[name]), 10);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be an integer.`);
  return value;
}

function boolArg(args, name, fallback) {
  if (args[name] === undefined) return fallback;
  return !["false", "0", "no"].includes(String(args[name]).toLowerCase());
}

function visualPrompt(prompt, args) {
  const value = String(prompt).trim();
  if (boolArg(args, "allow-text", false)) return value;
  const noTextRule =
    "No text, no letters, no numbers, no captions, no subtitles, no logo, no watermark, no readable symbols or characters anywhere in the image or video.";
  if (/no text|no letters|no watermark|不要文字|无文字/i.test(value)) return value;
  return `${value}. ${noTextRule}`;
}

async function request(method, path, body, responseType = "json") {
  const url = path.startsWith("http") ? path : `${host()}${path}`;
  const headers = {
    Authorization: `Bearer ${key()}`,
  };
  const init = { method, headers };
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${url} failed: ${response.status} ${response.statusText}\n${text}`);
  }
  if (responseType === "arrayBuffer") return response.arrayBuffer();
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function baseRespError(json) {
  const base = json?.base_resp;
  if (base && Number(base.status_code || 0) !== 0) {
    throw new Error(`MiniMax error ${base.status_code}: ${base.status_msg || "unknown"}`);
  }
}

async function writeHex(hex, out) {
  if (!out) return;
  await writeFile(out, Buffer.from(hex, "hex"));
}

async function tts(args) {
  const text = await textFromArgs(args);
  const out = args.out ? String(args.out) : undefined;
  const payload = {
    model: String(args.model || "speech-2.8-hd"),
    text,
    stream: false,
    voice_setting: {
      voice_id: String(args.voice || "male-qn-qingse"),
      speed: Number(args.speed || 1),
      vol: Number(args.vol || 1),
      pitch: Number(args.pitch || 0),
    },
    audio_setting: {
      sample_rate: intArg(args, "sample-rate", 32000),
      bitrate: intArg(args, "bitrate", 128000),
      format: String(args.format || "mp3"),
      channel: intArg(args, "channel", 1),
    },
    subtitle_enable: boolArg(args, "subtitle-enable", false),
  };
  if (args.emotion) payload.voice_setting.emotion = String(args.emotion);
  const json = await request("POST", "/v1/t2a_v2", payload);
  baseRespError(json);
  if (json?.data?.audio && out) {
    await writeHex(json.data.audio, out);
    json.data.audio = `[saved to ${out}]`;
    json.local_file = out;
  }
  printJson(json);
}

async function ttsAsyncCreate(args) {
  const text = await textFromArgs(args);
  const payload = {
    model: String(args.model || "speech-2.8-hd"),
    text,
    language_boost: String(args["language-boost"] || "auto"),
    voice_setting: {
      voice_id: String(args.voice || "audiobook_male_1"),
      speed: Number(args.speed || 1),
      vol: Number(args.vol || 1),
      pitch: Number(args.pitch || 1),
    },
    audio_setting: {
      audio_sample_rate: intArg(args, "sample-rate", 32000),
      bitrate: intArg(args, "bitrate", 128000),
      format: String(args.format || "mp3"),
      channel: intArg(args, "channel", 2),
    },
  };
  const json = await request("POST", "/v1/t2a_async_v2", payload);
  baseRespError(json);
  printJson(json);
}

async function ttsAsyncQuery(args) {
  const taskId = args["task-id"];
  if (!taskId) throw new Error("Provide --task-id.");
  const json = await request("GET", `/v1/query/t2a_async_query_v2?task_id=${encodeURIComponent(String(taskId))}`);
  baseRespError(json);
  printJson(json);
}

async function fileDownload(args) {
  const fileId = args["file-id"];
  const out = args.out;
  if (!fileId) throw new Error("Provide --file-id.");
  if (!out) throw new Error("Provide --out.");
  const bytes = await request(
    "GET",
    `/v1/files/retrieve_content?file_id=${encodeURIComponent(String(fileId))}`,
    null,
    "arrayBuffer",
  );
  await writeFile(String(out), Buffer.from(bytes));
  printJson({ local_file: String(out), file_id: String(fileId) });
}

async function lyrics(args) {
  const payload = {
    mode: String(args.mode || "write_full_song"),
    prompt: args.prompt ? String(args.prompt) : "",
  };
  if (args.title) payload.title = String(args.title);
  if (payload.mode === "edit") payload.lyrics = await lyricsFromArgs(args);
  const json = await request("POST", "/v1/lyrics_generation", payload);
  baseRespError(json);
  printJson(json);
}

async function music(args) {
  const payload = {
    model: String(args.model || "music-2.6"),
    prompt: String(args.prompt || ""),
    lyrics: await lyricsFromArgs(args),
    output_format: String(args["output-format"] || (args.out ? "hex" : "url")),
    audio_setting: {
      sample_rate: intArg(args, "sample-rate", 44100),
      bitrate: intArg(args, "bitrate", 256000),
      format: String(args.format || "mp3"),
    },
  };
  if (args["cover-feature-id"]) payload.cover_feature_id = String(args["cover-feature-id"]);
  if (args.stream !== undefined) payload.stream = boolArg(args, "stream", false);
  const json = await request("POST", "/v1/music_generation", payload);
  baseRespError(json);
  if (json?.data?.audio && args.out) {
    await writeHex(json.data.audio, String(args.out));
    json.data.audio = `[saved to ${String(args.out)}]`;
    json.local_file = String(args.out);
  }
  printJson(json);
}

async function musicCoverPreprocess(args) {
  const payload = {
    model: "music-cover",
  };
  if (args["audio-url"]) {
    payload.audio_url = String(args["audio-url"]);
  } else if (args["audio-file"]) {
    const buffer = await readFile(String(args["audio-file"]));
    payload.audio_base64 = buffer.toString("base64");
  } else {
    throw new Error("Provide --audio-url or --audio-file.");
  }
  const json = await request("POST", "/v1/music_cover_preprocess", payload);
  baseRespError(json);
  printJson(json);
}

async function image(args) {
  const prompt = args.prompt;
  if (!prompt) throw new Error("Provide --prompt.");
  const outDir = args["out-dir"] ? String(args["out-dir"]) : undefined;
  const responseFormat = String(args["response-format"] || (outDir ? "base64" : "url"));
  const payload = {
    model: String(args.model || "image-01"),
    prompt: visualPrompt(prompt, args),
    aspect_ratio: String(args["aspect-ratio"] || "1:1"),
    response_format: responseFormat,
    n: intArg(args, "n", 1),
    prompt_optimizer: boolArg(args, "prompt-optimizer", false),
  };
  if (args.width && args.height) {
    payload.width = intArg(args, "width");
    payload.height = intArg(args, "height");
  }
  if (args["subject-reference"]) {
    payload.subject_reference = [
      {
        type: String(args["subject-type"] || "character"),
        image_file: String(args["subject-reference"]),
      },
    ];
  }
  const json = await request("POST", "/v1/image_generation", payload);
  baseRespError(json);
  if (outDir && json?.data?.image_base64) {
    await mkdir(outDir, { recursive: true });
    const ext = extname(String(args.filename || "")) || ".jpeg";
    json.local_files = [];
    for (let i = 0; i < json.data.image_base64.length; i += 1) {
      const file = join(outDir, `image-${i + 1}${ext}`);
      await writeFile(file, Buffer.from(json.data.image_base64[i], "base64"));
      json.local_files.push(file);
    }
    json.data.image_base64 = json.local_files.map((file) => `[saved to ${file}]`);
  }
  printJson(json);
}

async function imageDataUrlFromArgs(args, fileKey, urlKey) {
  let imageUrl = args[urlKey];
  if (args[fileKey]) {
    const file = String(args[fileKey]);
    const buffer = await readFile(file);
    imageUrl = `data:${mimeFromPath(file)};base64,${buffer.toString("base64")}`;
  } else if (imageUrl && /^https?:\/\//.test(String(imageUrl)) && boolArg(args, "inline-image-url", false)) {
    const response = await fetch(String(imageUrl));
    if (!response.ok) {
      throw new Error(`Download image failed: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    imageUrl = `data:${mimeFromContentType(response.headers.get("content-type"))};base64,${buffer.toString("base64")}`;
  }
  return imageUrl ? String(imageUrl) : undefined;
}

function videoPayload(args, defaultModel) {
  const prompt = args.prompt;
  if (!prompt) throw new Error("Provide --prompt.");
  const payload = {
    model: String(args.model || defaultModel),
    prompt: visualPrompt(prompt, args),
    duration: intArg(args, "duration", 6),
    resolution: String(args.resolution || "768P"),
    prompt_optimizer: boolArg(args, "prompt-optimizer", true),
  };
  if (args["fast-pretreatment"] !== undefined) {
    payload.fast_pretreatment = boolArg(args, "fast-pretreatment", false);
  }
  if (args["callback-url"]) payload.callback_url = String(args["callback-url"]);
  return payload;
}

async function videoT2V(args) {
  const payload = videoPayload(args, "MiniMax-Hailuo-2.3");
  const json = await request("POST", "/v1/video_generation", payload);
  baseRespError(json);
  printJson(json);
}

async function videoI2V(args) {
  const payload = videoPayload(args, "MiniMax-Hailuo-2.3-Fast");
  const firstFrameImage = await imageDataUrlFromArgs(args, "image-file", "image-url");
  if (!firstFrameImage) throw new Error("Provide --image-url or --image-file.");
  payload.first_frame_image = firstFrameImage;
  if (payload.first_frame_image.startsWith("data:")) {
    payload.first_frame_image = payload.first_frame_image.replace(/base64,.+$/, "base64,[inline image]");
    const requestPayload = { ...payload, first_frame_image: firstFrameImage };
    const json = await request("POST", "/v1/video_generation", requestPayload);
    baseRespError(json);
    printJson({ ...json, request: payload });
    return;
  }
  const json = await request("POST", "/v1/video_generation", payload);
  baseRespError(json);
  printJson(json);
}

async function videoQuery(args) {
  const taskId = args["task-id"];
  if (!taskId) throw new Error("Provide --task-id.");
  const json = await request("GET", `/v1/query/video_generation?task_id=${encodeURIComponent(String(taskId))}`);
  baseRespError(json);
  printJson(json);
}

async function videoDownload(args) {
  const fileId = args["file-id"];
  const out = args.out;
  if (!fileId) throw new Error("Provide --file-id.");
  const json = await request("GET", `/v1/files/retrieve?file_id=${encodeURIComponent(String(fileId))}`);
  baseRespError(json);
  const downloadUrl = json?.file?.download_url;
  if (!downloadUrl) {
    printJson(json);
    return;
  }
  if (!out) {
    printJson(json);
    return;
  }
  const resolvedDownloadUrl = /^https?:\/\//.test(String(downloadUrl)) ? String(downloadUrl) : `https://${downloadUrl}`;
  const response = await fetch(resolvedDownloadUrl);
  if (!response.ok) {
    throw new Error(`Download video failed: ${response.status} ${response.statusText}`);
  }
  await writeFile(String(out), Buffer.from(await response.arrayBuffer()));
  printJson({ ...json, local_file: String(out) });
}

async function search(args) {
  const q = args.query || args.q;
  if (!q) throw new Error("Provide --query.");
  const count = intArg(args, "count", 10);
  const json = await request("POST", "/v1/coding_plan/search", { q: String(q) });
  baseRespError(json);
  const results = Array.isArray(json?.results) ? json.results.slice(0, count) : undefined;
  printJson(results ? { ...json, results } : json);
}

async function vlm(args) {
  const prompt = args.prompt;
  if (!prompt) throw new Error("Provide --prompt.");
  let imageUrl = args["image-url"];
  if (args["image-file"]) {
    const file = String(args["image-file"]);
    const buffer = await readFile(file);
    imageUrl = `data:${mimeFromPath(file)};base64,${buffer.toString("base64")}`;
  } else if (imageUrl && /^https?:\/\//.test(String(imageUrl))) {
    const response = await fetch(String(imageUrl));
    if (!response.ok) {
      throw new Error(`Download image failed: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    imageUrl = `data:${mimeFromContentType(response.headers.get("content-type"))};base64,${buffer.toString("base64")}`;
  }
  if (!imageUrl) throw new Error("Provide --image-url or --image-file.");
  const json = await request("POST", "/v1/coding_plan/vlm", {
    prompt: String(prompt),
    image_url: String(imageUrl),
  });
  baseRespError(json);
  printJson(json);
}

async function raw(args) {
  const method = String(args.method || "POST").toUpperCase();
  const path = args.path;
  if (!path) throw new Error("Provide --path.");
  const body = args.json ? JSON.parse(String(args.json)) : undefined;
  const json = await request(method, String(path), body);
  printJson(json);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  if (!COMMANDS.has(command)) {
    usage();
    throw new Error(`Unknown command: ${command}`);
  }
  const { args } = parseArgs(rest);
  switch (command) {
    case "help":
      usage();
      break;
    case "tts":
      await tts(args);
      break;
    case "tts-async-create":
      await ttsAsyncCreate(args);
      break;
    case "tts-async-query":
      await ttsAsyncQuery(args);
      break;
    case "file-download":
      await fileDownload(args);
      break;
    case "lyrics":
      await lyrics(args);
      break;
    case "music":
      await music(args);
      break;
    case "music-cover-preprocess":
      await musicCoverPreprocess(args);
      break;
    case "image":
      await image(args);
      break;
    case "video-t2v":
      await videoT2V(args);
      break;
    case "video-i2v":
      await videoI2V(args);
      break;
    case "video-query":
      await videoQuery(args);
      break;
    case "video-download":
      await videoDownload(args);
      break;
    case "search":
      await search(args);
      break;
    case "vlm":
      await vlm(args);
      break;
    case "raw":
      await raw(args);
      break;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
