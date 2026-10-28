import { BilingualField } from "@/components/admin/BilingualField";
import { DateTimeField } from "@/components/admin/DateTimeField";
import { EditorSection } from "@/components/admin/EditorSection";
import { SelectField } from "@/components/admin/fields";
import { FormShell } from "@/components/admin/FormShell";
import {
  EVENT_KIND_LABELS,
  EVENT_STATUS_LABELS,
  optionsOf,
} from "@/components/admin/labels";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { PublishControls } from "@/components/admin/PublishControls";
import { SlugField } from "@/components/admin/SlugField";
import { IMAGE_FIELD_HINT } from "@/components/admin/UploadHint";
import { MediaPickerField } from "@/components/admin/MediaPickerField";
import { getStorageMode } from "@/server/storage";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { Event } from "@/generated/prisma/client";
import { createEventAction, updateEventAction } from "@/server/actions/events";

/** Create / edit form for an event or mission trip. */
export function EventEditor({
  event,
  galleries,
}: {
  event?: Event;
  /** Edit mode: galleries linked to this event. */
  galleries?: {
    id: string;
    titleEn: string;
    status: "DRAFT" | "PUBLISHED";
    _count: { items: number };
  }[];
}) {
  return (
    <FormShell
      action={event ? updateEventAction : createEventAction}
      label={event ? "Edit event" : "New event"}
    >
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <EditorSection title="Basics">
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            name="kind"
            label="Kind"
            options={optionsOf(EVENT_KIND_LABELS)}
            defaultValue={event?.kind ?? "MISSION_TRIP"}
            required
          />
          <SelectField
            name="status"
            label="Event status"
            options={optionsOf(EVENT_STATUS_LABELS)}
            defaultValue={event?.status ?? "UPCOMING"}
            hint="Whether it is still ahead, done or cancelled."
            required
          />
        </div>
        <BilingualField
          name="title"
          label="Title"
          required
          maxLength={160}
          defaultEn={event?.titleEn}
          defaultNe={event?.titleNe}
        />
        <SlugField defaultValue={event?.slug} />
      </EditorSection>

      <EditorSection title="When and where">
        <div className="grid gap-5 md:grid-cols-2">
          <DateTimeField
            name="startsAt"
            label="Starts"
            defaultValue={event?.startsAt.toISOString() ?? null}
            required
          />
          <DateTimeField
            name="endsAt"
            label="Ends (optional)"
            defaultValue={event?.endsAt?.toISOString() ?? null}
          />
        </div>
        <BilingualField
          name="location"
          label="Location"
          maxLength={160}
          defaultEn={event?.locationEn}
          defaultNe={event?.locationNe}
        />
      </EditorSection>

      <EditorSection title="Description">
        <MarkdownEditor
          name="descriptionEn"
          label="Description (English)"
          lang="en"
          rows={6}
          defaultValue={event?.descriptionEn}
        />
        <MarkdownEditor
          name="descriptionNe"
          label="Description (नेपाली, Nepali)"
          lang="ne"
          rows={6}
          defaultValue={event?.descriptionNe}
          hint="Leave empty to show the English text."
        />
        <BilingualField
          name="volunteerInfo"
          label="How to help or volunteer"
          multiline
          rows={3}
          maxLength={2000}
          defaultEn={event?.volunteerInfoEn}
          defaultNe={event?.volunteerInfoNe}
        />
      </EditorSection>

      <EditorSection title="Post-trip report">
        <MarkdownEditor
          name="reportEn"
          label="Report (English)"
          lang="en"
          rows={6}
          defaultValue={event?.reportEn}
          hint="Optional. Share what happened after the event."
        />
        <MarkdownEditor
          name="reportNe"
          label="Report (नेपाली, Nepali)"
          lang="ne"
          rows={6}
          defaultValue={event?.reportNe}
          hint="Leave empty to show the English text."
        />
      </EditorSection>

      <EditorSection title="Display">
        <MediaPickerField
          name="coverImageUrl"
          label="Cover picture"
          defaultValue={event?.coverImageUrl}
          hint={IMAGE_FIELD_HINT}
          mode={getStorageMode()}
        />
      </EditorSection>

      {event ? (
        <EditorSection title="Galleries for this event">
          {galleries && galleries.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {galleries.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/galleries/${g.id}`}
                    className="font-medium text-navy underline decoration-gold underline-offset-4"
                  >
                    {g.titleEn}
                  </Link>
                  <StatusBadge status={g.status} />
                  <span className="text-sm text-navy/75">
                    {g._count.items === 1
                      ? "1 photo"
                      : `${g._count.items} photos`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-navy/80">
              No gallery is linked to this event yet.
            </p>
          )}
          <div>
            <Button
              href={`/admin/galleries/new?eventId=${event.id}`}
              variant="secondary"
            >
              New gallery for this event
            </Button>
          </div>
        </EditorSection>
      ) : null}

      <PublishControls status={event?.publishStatus ?? null} />
    </FormShell>
  );
}
