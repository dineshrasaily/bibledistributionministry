"use server";

import {
  contactSubmissionSchema,
  prayerSubmissionSchema,
  type PublicFormState,
} from "@/lib/validation/public-forms";
import { runPublicSubmission } from "@/server/forms/public-submission";
import {
  createContactMessage,
  createPrayerRequest,
} from "@/server/services/inbox-submit";

/** Public prayer form (no session needed; spam-protected pipeline). */
export async function submitPrayerAction(
  _prev: PublicFormState | null,
  formData: FormData,
): Promise<PublicFormState> {
  return runPublicSubmission(
    {
      form: "PRAYER",
      schema: prayerSubmissionSchema,
      turnstileAction: "prayer",
      create: createPrayerRequest,
      notifyKind: "prayer",
    },
    formData,
  );
}

/** Public contact form. */
export async function submitContactAction(
  _prev: PublicFormState | null,
  formData: FormData,
): Promise<PublicFormState> {
  return runPublicSubmission(
    {
      form: "CONTACT",
      schema: contactSubmissionSchema,
      turnstileAction: "contact",
      create: createContactMessage,
      notifyKind: "contact",
    },
    formData,
  );
}
