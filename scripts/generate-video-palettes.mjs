import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { videoCatalog } from '../src/data/catalog.js';

const WIDTH = 64;
const HEIGHT = 36;
const FALLBACK_PALETTE = ['#4c3129', '#673933', '#6e5146', '#8a736a'];
const DEFAULT_VIDEO_DIR = process.env.BELMONTGIRL_VIDEO_DIR?.trim() || null;
const DEFAULT_FFMPEG = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
const DEFAULT_OUTPUT = resolve('src/data/video-palettes.js');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function hasOption(name) {
  return process.argv.some((value) => value === `--${name}` || value.startsWith(`--${name}=`));
}

function printHelp() {
  console.log(`Usage:
  npm run generate:palettes
  npm run generate:palettes -- --only=c42Qr_j980g --output=.temp-kathy-palettes.js

Options:
  --only=<id[,id...]>      Process only selected catalog IDs.
  --limit=<number>         Process only the first N catalog entries.
  --interval=<seconds>     Seconds between samples. Default: 8.
  --video-dir=<path>       Local video directory. Also accepts BELMONTGIRL_VIDEO_DIR.
  --ffmpeg=<path>          FFmpeg executable path.
  --output=<path>          Generated JavaScript resource path.
  --include-local-only     Include catalog entries without a YouTube URL.
`);
}

function luminance(red, green, blue) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function colorDistance(first, second) {
  return Math.sqrt(first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0)) / 255;
}

function toHex([red, green, blue]) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function paletteFromFrame(frame) {
  const buckets = new Map();
  for (let offset = 0; offset + 2 < frame.length; offset += 3) {
    const red = frame[offset];
    const green = frame[offset + 1];
    const blue = frame[offset + 2];
    if (luminance(red, green, blue) < 0.08) continue;

    const key = `${Math.min(7, red >> 5)}-${Math.min(7, green >> 5)}-${Math.min(7, blue >> 5)}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map((bucket) => {
      const color = [
        Math.round(bucket.red / bucket.count),
        Math.round(bucket.green / bucket.count),
        Math.round(bucket.blue / bucket.count),
      ];
      return {
        color,
        score: bucket.count * (0.35 + 0.65 * luminance(...color)),
      };
    })
    .sort((first, second) => second.score - first.score);

  const selected = [];
  for (const candidate of candidates) {
    if (selected.every((color) => colorDistance(color, candidate.color) > 0.12)) selected.push(candidate.color);
    if (selected.length === 4) break;
  }
  if (!selected.length) return null;
  while (selected.length < 4) selected.push(selected[selected.length - 1]);
  return selected.map(toHex);
}

function fillMissingPalettes(samples) {
  let nextPalette = FALLBACK_PALETTE;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index].colors) nextPalette = samples[index].colors;
    else samples[index].colors = [...nextPalette];
  }
  return samples;
}

function decodeFrames(ffmpegPath, videoPath, interval) {
  return new Promise((resolveFrames, reject) => {
    const process = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', videoPath,
      '-an',
      '-vf', `fps=1/${interval},scale=${WIDTH}:${HEIGHT}:flags=bilinear`,
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24',
      'pipe:1',
    ], { windowsHide: true });
    const chunks = [];
    let errorOutput = '';
    let settled = false;

    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });
    process.once('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    process.once('close', (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) reject(new Error(errorOutput.trim() || `FFmpeg exited with code ${code}.`));
      else resolveFrames(Buffer.concat(chunks));
    });
  });
}

async function analyzeVideo(ffmpegPath, video, videoDir, interval) {
  const videoPath = join(videoDir, video.fileName);
  if (!existsSync(videoPath)) throw new Error(`Missing local video: ${videoPath}`);
  const rawFrames = await decodeFrames(ffmpegPath, videoPath, interval);
  const frameSize = WIDTH * HEIGHT * 3;
  const samples = [];
  for (let offset = 0, time = 0; offset + frameSize <= rawFrames.length; offset += frameSize, time += interval) {
    samples.push({ time, colors: paletteFromFrame(rawFrames.subarray(offset, offset + frameSize)) });
  }
  if (!samples.length) throw new Error(`No frames decoded for ${video.fileName}.`);
  return { id: video.id, samples: fillMissingPalettes(samples) };
}

function formatResource(palettes, interval) {
  const lines = [
    '// Generated by scripts/generate-video-palettes.mjs. Do not edit by hand.',
    '// Contains derived color metadata only; local videos are not copied here.',
    'export const videoPalettes = {',
  ];
  palettes.forEach(({ id, samples }) => {
    lines.push(`  ${JSON.stringify(id)}: {`);
    lines.push(`    sampleInterval: ${interval},`);
    lines.push('    samples: [');
    samples.forEach((sample) => lines.push(`      { time: ${sample.time}, colors: ${JSON.stringify(sample.colors)} },`));
    lines.push('    ],');
    lines.push('  },');
  });
  lines.push('};', '');
  return lines.join('\n');
}

async function main() {
  if (process.argv.includes('--help')) {
    printHelp();
    return;
  }

  const interval = Number(option('interval', '8'));
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('--interval must be a positive number.');

  const videoDirOption = option('video-dir', DEFAULT_VIDEO_DIR);
  if (!videoDirOption) {
    printHelp();
    throw new Error('Set BELMONTGIRL_VIDEO_DIR or pass --video-dir=<path>.');
  }

  const videoDir = resolve(videoDirOption);
  const ffmpegPath = option('ffmpeg', DEFAULT_FFMPEG);
  const outputPath = resolve(option('output', DEFAULT_OUTPUT));
  const requestedIds = (option('only', '') || '').split(',').map((id) => id.trim()).filter(Boolean);
  const limit = Number.parseInt(option('limit', ''), 10);
  const isPartialRun = requestedIds.length > 0 || Number.isFinite(limit);
  const includeLocalOnly = hasOption('include-local-only');

  if (isPartialRun && !hasOption('output')) {
    throw new Error('Partial runs require --output=<temporary-or-explicit-path> so the full resource is not overwritten.');
  }
  if (!existsSync(videoDir)) throw new Error(`Video directory not found: ${videoDir}`);

  let videos = includeLocalOnly ? videoCatalog : videoCatalog.filter((video) => video.youtubeUrl);
  const skippedLocalOnly = videoCatalog.filter((video) => !video.youtubeUrl);
  if (skippedLocalOnly.length && !includeLocalOnly) {
    console.log(`Skipping ${skippedLocalOnly.length} local-only catalog entry. Use --include-local-only to include it.`);
  }
  if (requestedIds.length) {
    videos = videoCatalog.filter((video) => requestedIds.includes(video.id) || requestedIds.includes(video.fileName));
    const missingIds = requestedIds.filter((id) => !videos.some((video) => video.id === id || video.fileName === id));
    if (missingIds.length) throw new Error(`IDs not found in catalog: ${missingIds.join(', ')}`);
  }
  if (Number.isFinite(limit)) videos = videos.slice(0, Math.max(0, limit));
  if (!videos.length) throw new Error('No videos selected.');

  const palettes = [];
  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    console.log(`[${index + 1}/${videos.length}] ${video.fileName}`);
    palettes.push(await analyzeVideo(ffmpegPath, video, videoDir, interval));
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatResource(palettes, interval), 'utf8');
  console.log(`Wrote ${palettes.length} palette entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(`Palette generation failed: ${error.message}`);
  process.exitCode = 1;
});
