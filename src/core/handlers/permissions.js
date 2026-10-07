import { PermissionFlagsBits } from "discord.js";
import { Permission } from "../command.js";

export function isAllowed(command, member) {
  const needed = command.permission || Permission.Everyone;

  if (needed === Permission.Everyone) return true;
  if (!member) return false;

  return member.permissions.has(PermissionFlagsBits[needed]);
}
