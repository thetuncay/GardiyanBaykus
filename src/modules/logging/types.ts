export const LOG_CHANNEL_DEFINITIONS = [
  { key: "memberLogs", name: "member-logs", description: "Member join/leave/update logs" },
  { key: "messageLogs", name: "message-logs", description: "Message delete/update/bulk logs" },
  { key: "moderationLogs", name: "moderation-logs", description: "Ban/unban/kick/timeout logs" },
  { key: "voiceLogs", name: "voice-logs", description: "Voice state logs" },
  { key: "roleLogs", name: "role-logs", description: "Role create/delete/update logs" },
  { key: "channelLogs", name: "channel-logs", description: "Channel create/delete/update logs" },
  { key: "serverLogs", name: "server-logs", description: "Guild and boost logs" },
  { key: "inviteLogs", name: "invite-logs", description: "Invite create/delete/usage logs" },
  { key: "emojiStickerLogs", name: "emoji-sticker-logs", description: "Emoji and sticker logs" },
] as const;

export type LogChannelKey = (typeof LOG_CHANNEL_DEFINITIONS)[number]["key"];

export const LOG_CATEGORY_NAME = "Logs";
