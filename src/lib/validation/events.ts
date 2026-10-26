import { z } from "zod";
import {
  ContentStatus,
  EventKind,
  EventStatus,
} from "@/generated/prisma/enums";
import {
  enumOf,
  idSchema,
  intentSchema,
  isoDateTime,
  optionalDateTime,
  optionalMarkdown,
  optionalSafeUrl,
  optionalText,
  requiredText,
  slugSchema,
} from "./common";

export const eventFields = {
  kind: enumOf(EventKind),
  slug: slugSchema,
  titleEn: requiredText(160),
  titleNe: optionalText(160),
  descriptionEn: optionalMarkdown(10_000),
  descriptionNe: optionalMarkdown(10_000),
  reportEn: optionalMarkdown(20_000),
  reportNe: optionalMarkdown(20_000),
  startsAt: isoDateTime,
  endsAt: optionalDateTime,
  locationEn: optionalText(160),
  locationNe: optionalText(160),
  volunteerInfoEn: optionalText(2000),
  volunteerInfoNe: optionalText(2000),
  status: enumOf(EventStatus),
  coverImageUrl: optionalSafeUrl(),
  intent: intentSchema,
};

const END_BEFORE_START_MSG = "The end must be on or after the start.";

function endsAfterStart(v: { startsAt: Date; endsAt: Date | null }): boolean {
  // Zod still runs object refinements when a field failed; skip until both are dates.
  if (!(v.startsAt instanceof Date) || !(v.endsAt instanceof Date)) return true;
  return v.endsAt.getTime() >= v.startsAt.getTime();
}

export const eventSchema = z
  .object(eventFields)
  .refine(endsAfterStart, { message: END_BEFORE_START_MSG, path: ["endsAt"] });

export const updateEventSchema = z
  .object({ id: idSchema, ...eventFields })
  .refine(endsAfterStart, { message: END_BEFORE_START_MSG, path: ["endsAt"] });

/** Visibility (publishStatus), not the lifecycle status. */
export const eventPublishSchema = z.object({
  id: idSchema,
  status: enumOf(ContentStatus),
});

export type EventInput = z.output<typeof eventSchema>;
export type UpdateEventInput = z.output<typeof updateEventSchema>;
export type EventPublishInput = z.output<typeof eventPublishSchema>;
