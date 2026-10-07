import { ui } from "../core/ui.js";
import { getPlayer, nodeReady } from "./lavalink.js";

export function requireNode() {
  if (!nodeReady()) {
    return "The audio server is offline right now. Try again in a moment.";
  }
  return null;
}

export function requirePlaying(ctx) {
  const player = getPlayer(ctx.guild.id);
  if (!player?.queue.current) return "Nothing is playing right now. Start something with `/play`.";
  return null;
}

export function requireVoice(ctx) {
  if (!ctx.member?.voice?.channelId) return "Join a voice channel first, then ask again.";
  return null;
}

export function requireSameChannel(ctx) {
  const player = getPlayer(ctx.guild.id);
  const listening = ctx.member?.voice?.channelId;

  if (!listening) return "Join a voice channel first, then ask again.";

  if (player?.voiceChannelId && listening !== player.voiceChannelId) {
    return `I'm playing in <#${player.voiceChannelId}> - join that one to use the controls.`;
  }
  return null;
}

export function guarded(checks, body) {
  return async (ctx) => {
    for (const check of checks) {
      const problem = check(ctx);
      if (problem) return ctx.reply(ui.notice(problem), { ephemeral: true });
    }
    return body(ctx, getPlayer(ctx.guild.id));
  };
}
