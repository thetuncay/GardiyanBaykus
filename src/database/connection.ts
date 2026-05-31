import mongoose from "mongoose";
import { createLogger } from "../services/logger.js";

const log = createLogger("mongo");

export async function connectMongo(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 30_000,
  });
  log.info("MongoDB connected");
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  log.info("MongoDB disconnected");
}
