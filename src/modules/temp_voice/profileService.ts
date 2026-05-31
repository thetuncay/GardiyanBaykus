import { VoiceProfileModel, type VoiceProfileDoc } from "../../database/models/VoiceProfile.js";

export async function getVoiceProfile(
  guildId: string,
  userId: string,
): Promise<VoiceProfileDoc | null> {
  return VoiceProfileModel.findOne({ guildId, userId }).lean() as Promise<VoiceProfileDoc | null>;
}

export async function ensureVoiceProfile(
  guildId: string,
  userId: string,
): Promise<VoiceProfileDoc> {
  const doc = await VoiceProfileModel.findOneAndUpdate(
    { guildId, userId },
    { $setOnInsert: { guildId, userId } },
    { upsert: true, new: true },
  ).lean();
  return doc as VoiceProfileDoc;
}

export async function persistChannelName(
  guildId: string,
  userId: string,
  channelName: string,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId },
    { $set: { channelName }, $setOnInsert: { guildId, userId } },
    { upsert: true },
  );
}

export async function persistUserLimit(
  guildId: string,
  userId: string,
  userLimit: number,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId },
    { $set: { userLimit }, $setOnInsert: { guildId, userId } },
    { upsert: true },
  );
}

export async function persistBitrate(
  guildId: string,
  userId: string,
  bitrate: number,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId },
    { $set: { bitrate }, $setOnInsert: { guildId, userId } },
    { upsert: true },
  );
}

export async function persistEveryonePublic(
  guildId: string,
  userId: string,
  everyonePublic: boolean,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId },
    { $set: { everyonePublic }, $setOnInsert: { guildId, userId } },
    { upsert: true },
  );
}

export async function persistHidden(
  guildId: string,
  userId: string,
  hidden: boolean,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId },
    { $set: { hidden }, $setOnInsert: { guildId, userId } },
    { upsert: true },
  );
}

export async function persistAllowedAdd(
  guildId: string,
  ownerId: string,
  targetId: string,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId: ownerId },
    {
      $addToSet: { allowedUserIds: targetId },
      $pull: { bannedUserIds: targetId },
      $setOnInsert: { guildId, userId: ownerId },
    },
    { upsert: true },
  );
}

export async function persistAllowedRemove(
  guildId: string,
  ownerId: string,
  targetId: string,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId: ownerId },
    { $pull: { allowedUserIds: targetId } },
  );
}

export async function persistBanAdd(
  guildId: string,
  ownerId: string,
  targetId: string,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId: ownerId },
    {
      $addToSet: { bannedUserIds: targetId },
      $pull: { allowedUserIds: targetId },
      $setOnInsert: { guildId, userId: ownerId },
    },
    { upsert: true },
  );
}

export async function persistBanRemove(
  guildId: string,
  ownerId: string,
  targetId: string,
): Promise<void> {
  await VoiceProfileModel.updateOne(
    { guildId, userId: ownerId },
    { $pull: { bannedUserIds: targetId } },
  );
}
