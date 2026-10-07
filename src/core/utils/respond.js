import { MessageFlags } from "discord.js";

export async function ackUpdate(interaction) {
  if (interaction.deferred || interaction.replied) return true;

  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    if (isDead(error)) return false;
    throw error;
  }
}

export async function ackReply(interaction, { ephemeral = false } = {}) {
  if (interaction.deferred || interaction.replied) return true;

  try {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    return true;
  } catch (error) {
    if (isDead(error)) return false;
    throw error;
  }
}

export async function answer(interaction, body) {
  try {
    if (interaction.deferred) return await interaction.editReply(body);
    if (interaction.replied) return await interaction.followUp(body);
    return await interaction.reply(body);
  } catch (error) {
    if (isDead(error)) return null;
    console.error("Answering the interaction failed:", error.message);
    return null;
  }
}

const DEAD = new Set([10062, 40060, 10008]);

export function isDead(error) {
  return DEAD.has(error?.code);
}
