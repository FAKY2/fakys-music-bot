import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 128;

const INK = {
  light: "#f2f3f5",
  blurple: "#5865f2",
  green: "#3ba55d",
  red: "#ed4245",
  violet: "#a855f7",
};

const ICONS = {
  play: (ctx) => triangle(ctx, INK.green),

  pause: (ctx) => {
    ctx.fillStyle = INK.light;
    bar(ctx, 40, 30, 16, 68);
    bar(ctx, 72, 30, 16, 68);
  },

  stop: (ctx) => {
    ctx.fillStyle = INK.red;
    round(ctx, 34, 34, 60, 60, 10);
    ctx.fill();
  },

  skip: (ctx) => {
    ctx.fillStyle = INK.light;
    tri(ctx, 30, 30, 30, 68, 32);
    tri(ctx, 62, 30, 30, 68, 32);
    bar(ctx, 92, 30, 12, 68);
  },

  previous: (ctx) => {
    ctx.fillStyle = INK.light;
    bar(ctx, 24, 30, 12, 68);
    tri(ctx, 66, 30, -30, 68, 32);
    tri(ctx, 98, 30, -30, 68, 32);
  },

  loop: (ctx) => arrows(ctx, INK.violet),

  shuffle: (ctx) => {
    ctx.strokeStyle = INK.blurple;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(26, 40);
    ctx.bezierCurveTo(52, 40, 76, 88, 102, 88);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(26, 88);
    ctx.bezierCurveTo(52, 88, 76, 40, 102, 40);
    ctx.stroke();

    ctx.fillStyle = INK.blurple;
    tri(ctx, 88, 26, 22, 28, 22);
    tri(ctx, 88, 74, 22, 28, 22);
  },

  queue: (ctx) => {
    ctx.fillStyle = INK.light;
    for (const y of [34, 58, 82]) {
      round(ctx, 26, y, 60, 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = INK.blurple;
    tri(ctx, 94, 74, 18, 26, 18);
  },

  volume: (ctx) => {
    speaker(ctx, INK.light);
    ctx.strokeStyle = INK.light;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    for (const radius of [22, 38]) {
      ctx.beginPath();
      ctx.arc(70, 64, radius, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
  },

  mute: (ctx) => {
    speaker(ctx, INK.light);
    ctx.strokeStyle = INK.red;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(74, 46);
    ctx.lineTo(108, 82);
    ctx.moveTo(108, 46);
    ctx.lineTo(74, 82);
    ctx.stroke();
  },

  music: (ctx) => note(ctx, INK.blurple),
  artist: (ctx) => mic(ctx, INK.violet),
  disc: (ctx) => disc(ctx, INK.light),

  heart: (ctx) => {
    ctx.fillStyle = INK.red;
    ctx.beginPath();
    ctx.moveTo(64, 102);
    ctx.bezierCurveTo(18, 72, 22, 34, 46, 30);
    ctx.bezierCurveTo(58, 28, 64, 38, 64, 44);
    ctx.bezierCurveTo(64, 38, 70, 28, 82, 30);
    ctx.bezierCurveTo(106, 34, 110, 72, 64, 102);
    ctx.closePath();
    ctx.fill();
  },

  filter: (ctx) => {
    ctx.strokeStyle = INK.light;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";

    for (const [x, knob] of [[38, 44], [64, 78], [90, 58]]) {
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x, 102);
      ctx.stroke();

      ctx.fillStyle = INK.blurple;
      ctx.beginPath();
      ctx.arc(x, knob, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  autoplay: (ctx) => {
    ctx.strokeStyle = INK.violet;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(64 + side * 20, 64, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = INK.light;
    tri(ctx, 56, 50, 18, 28, 18);
  },

  playlist: (ctx) => {
    ctx.fillStyle = INK.light;
    for (const y of [30, 54, 78]) {
      round(ctx, 22, y, 52, 10, 5);
      ctx.fill();
    }

    ctx.fillStyle = INK.blurple;
    round(ctx, 22, 96, 34, 10, 5);
    ctx.fill();

    round(ctx, 92, 60, 9, 40, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(88, 100, 14, 10, -0.25, 0, Math.PI * 2);
    ctx.fill();
  },

  search: (ctx) => {
    ctx.strokeStyle = INK.light;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(56, 54, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(76, 76);
    ctx.lineTo(100, 100);
    ctx.stroke();
  },

  live: (ctx) => {
    ctx.fillStyle = INK.red;
    ctx.beginPath();
    ctx.arc(64, 64, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = INK.red;
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(64, 64, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

function bar(ctx, x, y, width, height) {
  round(ctx, x, y, width, height, width / 2);
  ctx.fill();
}

function round(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function tri(ctx, x, y, width, height, depth) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (width < 0 ? -depth : depth), y + height / 2);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();
}

function triangle(ctx, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(42, 28);
  ctx.lineTo(100, 64);
  ctx.lineTo(42, 100);
  ctx.closePath();
  ctx.fill();
}

function arrows(ctx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(64, 64, 34, Math.PI, Math.PI * 1.75);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 0.75);
  ctx.stroke();

  ctx.fillStyle = color;
  tri(ctx, 84, 18, 22, 26, 20);
  tri(ctx, 44, 84, -22, 26, 20);
}

function speaker(ctx, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(22, 52);
  ctx.lineTo(42, 52);
  ctx.lineTo(62, 32);
  ctx.lineTo(62, 96);
  ctx.lineTo(42, 76);
  ctx.lineTo(22, 76);
  ctx.closePath();
  ctx.fill();
}

function note(ctx, color) {
  ctx.fillStyle = color;

  round(ctx, 62, 22, 12, 66, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(62, 22);
  ctx.lineTo(104, 34);
  ctx.lineTo(104, 54);
  ctx.lineTo(62, 42);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(50, 88, 22, 16, -0.25, 0, Math.PI * 2);
  ctx.fill();
}

function mic(ctx, color) {
  ctx.fillStyle = color;
  round(ctx, 50, 18, 28, 54, 14);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(64, 62, 30, 0, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(64, 92);
  ctx.lineTo(64, 110);
  ctx.stroke();
}

function disc(ctx, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(64, 64, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = INK.blurple;
  ctx.beginPath();
  ctx.arc(64, 64, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(64, 64, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "emojis");

await mkdir(out, { recursive: true });

for (const [name, draw] of Object.entries(ICONS)) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, SIZE, SIZE);
  draw(ctx);

  await writeFile(join(out, `${name}.png`), canvas.toBuffer("image/png"));
}

console.log(`Wrote ${Object.keys(ICONS).length} emojis to ./emojis`);
console.log("Restart the bot and it uploads them to the application on boot.");
