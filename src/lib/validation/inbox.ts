import { z } from "zod";
import { MessageStatus, PrayerStatus } from "@/generated/prisma/enums";
import { enumOf, idSchema } from "./common";

export const prayerStatusSchema = z.object({
  id: idSchema,
  status: enumOf(PrayerStatus),
});

export const messageStatusSchema = z.object({
  id: idSchema,
  status: enumOf(MessageStatus),
});

export type PrayerStatusInput = z.output<typeof prayerStatusSchema>;
export type MessageStatusInput = z.output<typeof messageStatusSchema>;
