import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { AttachmentBuilder } from "discord.js";

const WIDTH = 1000;
const HEIGHT = 320;

const PAD = 32;

const COVER = 224;
const COVER_X = PAD;
const COVER_Y = (HEIGHT - COVER) / 2;
const COVER_RADIUS = 18;

const TEXT_X = COVER_X + COVER + 32;
const TEXT_RIGHT = WIDTH - PAD;
const TEXT_WIDTH = TEXT_RIGHT - TEXT_X;

const BAR_HEIGHT = 10;
const BAR_Y = 214;
const BAR_RADIUS = BAR_HEIGHT / 2;
const KNOB = 9;

const FOOTER_Y = 262;

const COLOR = {
  backdrop: "#111214",
  track: "rgba(255, 255, 255, 0.22)",
  fillFrom: "#5865f2",
  fillTo: "#c084fc",
  knob: "#ffffff",
  title: "#ffffff",
  artist: "rgba(255, 255, 255, 0.82)",
  muted: "rgba(255, 255, 255, 0.62)",
  live: "#ed4245",
  badge: "rgba(255, 255, 255, 0.10)",
};

const FONT = GlobalFonts.has("gg sans") ? "gg sans" : "sans-serif";

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (value) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatLong(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  if (total < 60) return `${total} s`;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (!hours) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

const covers = new Map();
const COVER_CACHE_MAX = 40;

async function coverImage(url) {
  if (!url) return null;
  if (covers.has(url)) return covers.get(url);

  let image = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      image = await loadImage(Buffer.from(await response.arrayBuffer()));
    }
  } catch {
    image = null;
  }

  if (covers.size >= COVER_CACHE_MAX) {
    covers.delete(covers.keys().next().value);
  }
  covers.set(url, image);
  return image;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function drawNote(ctx, x, y, color) {
  ctx.fillStyle = color;

  roundedRect(ctx, x + 4, y - 46, 9, 62, 4);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 4, y - 46);
  ctx.lineTo(x + 40, y - 36);
  ctx.lineTo(x + 40, y - 18);
  ctx.lineTo(x + 4, y - 28);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x - 6, y + 16, 18, 13, -0.25, 0, Math.PI * 2);
  ctx.fill();
}

function fit(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;

  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}...`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trim()}...`;
}

function badge(ctx, x, glyph, text) {
  ctx.font = `600 19px "${FONT}"`;

  const textWidth = ctx.measureText(text).width;
  const width = textWidth + (glyph ? 46 : 26);

  ctx.fillStyle = COLOR.badge;
  roundedRect(ctx, x, FOOTER_Y - 4, width, 34, 17);
  ctx.fill();

  if (glyph) glyph(ctx, x + 14, FOOTER_Y + 7, COLOR.muted);

  ctx.font = `600 19px "${FONT}"`;
  ctx.fillStyle = COLOR.muted;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, x + (glyph ? 34 : 13), FOOTER_Y + 4);

  return x + width + 10;
}

function glyphPlay(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + 13, y + 7);
  ctx.lineTo(x + 1, y + 14);
  ctx.closePath();
  ctx.fill();
}

function glyphPause(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, 4, 14);
  ctx.fillRect(x + 9, y, 4, 14);
}

function glyphVolume(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x + 4, y + 5);
  ctx.lineTo(x + 8, y + 1);
  ctx.lineTo(x + 8, y + 13);
  ctx.lineTo(x + 4, y + 9);
  ctx.lineTo(x, y + 9);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x + 9, y + 7, 4.5, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();
}

function glyphMute(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x + 4, y + 5);
  ctx.lineTo(x + 8, y + 1);
  ctx.lineTo(x + 8, y + 13);
  ctx.lineTo(x + 4, y + 9);
  ctx.lineTo(x, y + 9);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 4);
  ctx.lineTo(x + 15, y + 10);
  ctx.moveTo(x + 15, y + 4);
  ctx.lineTo(x + 10, y + 10);
  ctx.stroke();
}

function glyphLoop(one) {
  return (ctx, x, y, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.arc(x + 7, y + 7, 6, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 7, y + 7, 6, Math.PI * -0.1, Math.PI * 0.9);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 11, y - 1);
    ctx.lineTo(x + 14, y + 3);
    ctx.lineTo(x + 9, y + 3);
    ctx.closePath();
    ctx.fill();

    if (one) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `700 10px "${FONT}"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("1", x + 7, y + 8);
      ctx.restore();
    }
  };
}

function glyphDisc(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;

  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 6.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 2, 0, Math.PI * 2);
  ctx.fill();
}

function glyphFilter(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;

  for (const [index, height] of [4, 10, 7].entries()) {
    const bar = x + 1 + index * 5;
    ctx.beginPath();
    ctx.moveTo(bar, y + 13);
    ctx.lineTo(bar, y + 13 - height);
    ctx.stroke();
  }
}

function glyphClock(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;

  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 6.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 7, y + 3.5);
  ctx.lineTo(x + 7, y + 7.5);
  ctx.lineTo(x + 10, y + 9);
  ctx.stroke();
}

export async function renderCard(track, state = {}) {
  const {
    elapsed = 0,
    paused = false,
    volume = 100,
    loop = "off",
    position = 0,
    total = 0,
    remaining = 0,
    filters = [],
  } = state;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const cover = await coverImage(track.thumbnail);

  ctx.fillStyle = COLOR.backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (cover) {
    ctx.save();
    ctx.filter = "blur(28px) saturate(150%)";
    drawCover(ctx, cover, -60, -60, WIDTH + 120, HEIGHT + 120);
    ctx.restore();

    const shade = ctx.createLinearGradient(0, 0, WIDTH, 0);
    shade.addColorStop(0, "rgba(10, 10, 12, 0.72)");
    shade.addColorStop(1, "rgba(10, 10, 12, 0.88)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.save();
  roundedRect(ctx, COVER_X, COVER_Y, COVER, COVER, COVER_RADIUS);
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, COVER_X, COVER_Y, COVER, COVER, COVER_RADIUS);
  ctx.clip();

  if (cover) {
    drawCover(ctx, cover, COVER_X, COVER_Y, COVER, COVER);
  } else {
    const fallback = ctx.createLinearGradient(COVER_X, COVER_Y, COVER_X + COVER, COVER_Y + COVER);
    fallback.addColorStop(0, COLOR.fillFrom);
    fallback.addColorStop(1, COLOR.fillTo);
    ctx.fillStyle = fallback;
    ctx.fillRect(COVER_X, COVER_Y, COVER, COVER);

    drawNote(ctx, COVER_X + COVER / 2, COVER_Y + COVER / 2, "rgba(255, 255, 255, 0.9)");
  }
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.font = `700 16px "${FONT}"`;
  ctx.fillStyle = COLOR.muted;
  const label = track.isLive ? "LIVE NOW" : paused ? "PAUSED" : "NOW PLAYING";
  ctx.fillText(spaced(label), TEXT_X, 52);

  if (total > 1) {
    ctx.textAlign = "right";
    ctx.fillText(`${position} / ${total}`, TEXT_RIGHT, 52);
    ctx.textAlign = "left";
  }

  ctx.font = `700 38px "${FONT}"`;
  ctx.fillStyle = COLOR.title;
  ctx.fillText(fit(ctx, track.title, TEXT_WIDTH), TEXT_X, 82);

  ctx.font = `500 24px "${FONT}"`;
  ctx.fillStyle = COLOR.artist;
  ctx.fillText(fit(ctx, track.artist, TEXT_WIDTH), TEXT_X, 132);

  const live = Boolean(track.isLive);
  const duration = track.duration || 0;
  const ratio = live || !duration ? 1 : Math.max(0, Math.min(1, elapsed / duration));
  const played = TEXT_WIDTH * ratio;

  ctx.fillStyle = COLOR.track;
  roundedRect(ctx, TEXT_X, BAR_Y, TEXT_WIDTH, BAR_HEIGHT, BAR_RADIUS);
  ctx.fill();

  if (played > 1) {
    if (live) {
      ctx.fillStyle = COLOR.live;
    } else {
      const fill = ctx.createLinearGradient(TEXT_X, 0, TEXT_X + TEXT_WIDTH, 0);
      fill.addColorStop(0, COLOR.fillFrom);
      fill.addColorStop(1, COLOR.fillTo);
      ctx.fillStyle = fill;
    }
    roundedRect(ctx, TEXT_X, BAR_Y, Math.max(played, BAR_HEIGHT), BAR_HEIGHT, BAR_RADIUS);
    ctx.fill();
  }

  if (!live) {
    const knobX = Math.max(TEXT_X + KNOB, Math.min(TEXT_X + played, TEXT_X + TEXT_WIDTH - KNOB));

    ctx.beginPath();
    ctx.arc(knobX, BAR_Y + BAR_HEIGHT / 2, KNOB, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.knob;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.font = `600 18px "${FONT}"`;
  ctx.textBaseline = "top";

  ctx.fillStyle = live ? COLOR.live : COLOR.muted;
  ctx.textAlign = "left";
  ctx.fillText(live ? "LIVE" : formatTime(elapsed), TEXT_X, BAR_Y + BAR_HEIGHT + 12);

  if (!live) {
    ctx.fillStyle = COLOR.muted;
    ctx.textAlign = "right";
    ctx.fillText(formatTime(duration), TEXT_RIGHT, BAR_Y + BAR_HEIGHT + 12);
  }

  let x = TEXT_X;
  x = badge(ctx, x, paused ? glyphPause : glyphPlay, paused ? "Paused" : "Playing");
  x = badge(ctx, x, volume === 0 ? glyphMute : glyphVolume, `${volume}%`);

  if (loop && loop !== "off") {
    x = badge(ctx, x, glyphLoop(loop === "track"), loop === "track" ? "Track" : "Queue");
  }

  if (remaining > 0) {
    x = badge(ctx, x, glyphClock, `${formatLong(remaining)} left`);
  }

  if (filters.length) {
    x = badge(ctx, x, glyphFilter, filters.slice(0, 2).join(", "));
  }

  if (track.source) {
    badge(ctx, x, glyphDisc, track.source);
  }

  return canvas.toBuffer("image/png");
}

function spaced(text) {
  return text.split("").join(" ");
}

let stamp = 0;

export async function cardAttachment(track, state) {
  const name = `player-${stamp++}.png`;
  const file = new AttachmentBuilder(await renderCard(track, state), { name });

  return { file, url: `attachment://${name}` };
}

export function cardAlt(track, state = {}) {
  const where = track.isLive
    ? "live"
    : `${formatTime(state.elapsed || 0)} of ${formatTime(track.duration)}`;
  return `${track.title} by ${track.artist}, ${state.paused ? "paused" : "playing"}, ${where}`;
}
