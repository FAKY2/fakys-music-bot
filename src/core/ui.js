import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";

export const Accent = {
  primary: 0x5865f2,
  success: 0x57f287,
  danger: 0xed4245,
  warning: 0xfee75c,
  muted: 0x2b2d31,
};

function toEmoji(emoji) {
  if (!emoji || typeof emoji === "object") return emoji;

  const custom = emoji.match(/^<(a?):(\w+):(\d+)>$/);
  if (custom) {
    return { animated: custom[1] === "a", name: custom[2], id: custom[3] };
  }
  return { name: emoji };
}

const STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

function append(box, part) {
  if (part instanceof TextDisplayBuilder) return box.addTextDisplayComponents(part);
  if (part instanceof SectionBuilder) return box.addSectionComponents(part);
  if (part instanceof SeparatorBuilder) return box.addSeparatorComponents(part);
  if (part instanceof ActionRowBuilder) return box.addActionRowComponents(part);
  if (part instanceof MediaGalleryBuilder) return box.addMediaGalleryComponents(part);
  if (part instanceof FileBuilder) return box.addFileComponents(part);

  throw new Error(
    "ui.container() got something it cannot place. Use the ui helpers (text, section, divider, row, gallery, file) or the matching discord.js builders."
  );
}

export const ui = {
  container(...parts) {
    const box = new ContainerBuilder();
    if (typeof parts[0] === "number") box.setAccentColor(parts.shift());

    for (const part of parts.flat(Infinity)) {
      if (!part) continue;
      append(box, typeof part === "string" ? ui.text(part) : part);
    }
    return box;
  },

  text(...lines) {
    return new TextDisplayBuilder().setContent(lines.join("\n"));
  },

  section(content, accessory) {
    const box = new SectionBuilder();

    const lines = Array.isArray(content) ? content : [content];
    box.addTextDisplayComponents(lines.map((line) => ui.text(line)));

    if (typeof accessory === "string") accessory = ui.thumb(accessory);
    if (accessory instanceof ButtonBuilder) box.setButtonAccessory(accessory);
    else if (accessory instanceof ThumbnailBuilder) box.setThumbnailAccessory(accessory);

    return box;
  },

  thumb(url, alt) {
    const thumb = new ThumbnailBuilder().setURL(url);
    if (alt) thumb.setDescription(alt);
    return thumb;
  },

  divider(large = false) {
    return new SeparatorBuilder().setSpacing(
      large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
    );
  },

  gap(large = true) {
    return new SeparatorBuilder()
      .setDivider(false)
      .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
  },

  row(...items) {
    return new ActionRowBuilder().addComponents(...items.flat());
  },

  button(id, label, style = "secondary", emoji) {
    const button = new ButtonBuilder().setCustomId(id).setStyle(STYLES[style] ?? style);

    if (label?.trim()) button.setLabel(label);
    if (emoji) button.setEmoji(emoji);
    return button;
  },

  link(url, label, emoji) {
    const button = new ButtonBuilder().setURL(url).setLabel(label).setStyle(ButtonStyle.Link);
    if (emoji) button.setEmoji(emoji);
    return button;
  },

  select(id, placeholder, options, { min, max, disabled } = {}) {
    const menu = new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder);

    menu.addOptions(
      options.map((option) => {
        if (typeof option === "string") return { label: option, value: option };
        return { ...option, emoji: toEmoji(option.emoji) };
      })
    );

    if (min !== undefined) menu.setMinValues(min);
    if (max !== undefined) menu.setMaxValues(max);
    if (disabled) menu.setDisabled(true);
    return menu;
  },

  userSelect(id, placeholder, { min, max } = {}) {
    return configureAuto(new UserSelectMenuBuilder(), id, placeholder, min, max);
  },
  roleSelect(id, placeholder, { min, max } = {}) {
    return configureAuto(new RoleSelectMenuBuilder(), id, placeholder, min, max);
  },
  channelSelect(id, placeholder, { min, max, types, defaults } = {}) {
    const menu = configureAuto(new ChannelSelectMenuBuilder(), id, placeholder, min, max);
    if (types?.length) menu.setChannelTypes(...types);
    if (defaults?.length) menu.setDefaultChannels(...defaults);
    return menu;
  },
  mentionableSelect(id, placeholder, { min, max } = {}) {
    return configureAuto(new MentionableSelectMenuBuilder(), id, placeholder, min, max);
  },

  gallery(...items) {
    return new MediaGalleryBuilder().addItems(
      items.flat().map((item) => {
        if (typeof item === "string") item = { url: item };
        const built = new MediaGalleryItemBuilder().setURL(item.url);
        if (item.alt) built.setDescription(item.alt);
        if (item.spoiler) built.setSpoiler(true);
        return built;
      })
    );
  },

  file(url, spoiler = false) {
    const file = new FileBuilder().setURL(url);
    if (spoiler) file.setSpoiler(true);
    return file;
  },

  modal(id, title, ...inputs) {
    return new ModalBuilder().setCustomId(id).setTitle(title).addLabelComponents(...inputs);
  },

  input(id, label, { long, required = true, placeholder, value, min, max } = {}) {
    const field = new TextInputBuilder()
      .setCustomId(id)
      .setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(required);

    if (placeholder) field.setPlaceholder(placeholder);
    if (value) field.setValue(value);
    if (min !== undefined) field.setMinLength(min);
    if (max !== undefined) field.setMaxLength(max);

    return new LabelBuilder().setLabel(label).setTextInputComponent(field);
  },

  notice(...lines) {
    return ui.container(ui.text(...lines.flat().filter(Boolean)));
  },
};

function configureAuto(menu, id, placeholder, min, max) {
  menu.setCustomId(id).setPlaceholder(placeholder);
  if (min !== undefined) menu.setMinValues(min);
  if (max !== undefined) menu.setMaxValues(max);
  return menu;
}

export function payload(view, { ephemeral = false } = {}) {
  let built;

  if (typeof view === "string") {
    built = { content: view };
  } else if (Array.isArray(view)) {
    built = { components: view, flags: MessageFlags.IsComponentsV2 };
  } else if (view instanceof ContainerBuilder) {
    built = { components: [view], flags: MessageFlags.IsComponentsV2 };
  } else {
    built = { ...view };
  }

  if (ephemeral) built.flags = (built.flags || 0) | MessageFlags.Ephemeral;
  return built;
}

const INTERACTIVE = new Set([2, 3, 5, 6, 7, 8]);

export function disableAll(view) {
  const node = typeof view.toJSON === "function" ? view.toJSON() : structuredClone(view);

  const strip = (part) => {
    if (INTERACTIVE.has(part.type)) part.disabled = true;
    if (part.components) part.components.forEach(strip);
    if (part.accessory) strip(part.accessory);
    return part;
  };
  return strip(node);
}

export async function disableComponents(client, channelId, messageId, { delay = 0 } = {}) {
  const apply = async () => {
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    return message.edit({ components: message.components.map(disableAll) });
  };

  if (!delay) return apply();
  setTimeout(() => apply().catch((error) => console.error("disableComponents failed:", error)), delay);
}

export function send(target, view, opts = {}) {
  const body = payload(view, opts);

  if (typeof target.deferReply === "function") {
    if (target.deferred) return target.editReply(body);
    if (target.replied) return target.followUp(body);
    return target.reply(body);
  }

  if (typeof target.reply === "function") return target.reply(payload(view));
  return target.send(payload(view));
}
