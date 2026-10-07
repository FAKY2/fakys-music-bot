import { PermissionFlagsBits } from "discord.js";

const TTL = 5 * 60_000;

const ballots = new Map();

export function listeners(client, player) {
  const channel = client.channels.cache.get(player?.voiceChannelId);
  if (!channel) return 0;

  return channel.members.filter((member) => !member.user.bot).size;
}

export function needed(count) {
  return Math.max(1, Math.ceil(count / 2));
}

export function privileged(member, player) {
  if (!member) return false;

  if (
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions?.has(PermissionFlagsBits.MoveMembers)
  ) {
    return true;
  }

  return player?.queue.current?.requester?.id === member.id;
}

export function alone(client, player) {
  return listeners(client, player) <= 1;
}

export function castVote(guildId, key, userId, quorum) {
  const id = `${guildId}:${key}`;
  const now = Date.now();

  let ballot = ballots.get(id);
  if (!ballot || now - ballot.at > TTL) {
    ballot = { voters: new Set(), at: now };
    ballots.set(id, ballot);
  }

  ballot.at = now;

  const already = ballot.voters.has(userId);
  ballot.voters.add(userId);

  const votes = ballot.voters.size;
  const passed = votes >= quorum;

  if (passed) ballots.delete(id);

  return { votes, quorum, passed, already };
}

export function clearVotes(guildId) {
  for (const id of ballots.keys()) {
    if (id.startsWith(`${guildId}:`)) ballots.delete(id);
  }
}

export function requireVote(ctx, client, player, key) {
  if (privileged(ctx.member, player) || alone(client, player)) return null;

  const quorum = needed(listeners(client, player));
  const result = castVote(ctx.guild.id, key, ctx.user.id, quorum);

  if (result.passed) return null;

  return result.already
    ? `You already voted - **${result.votes}/${result.quorum}** so far.`
    : `Vote counted: **${result.votes}/${result.quorum}** needed.`;
}
