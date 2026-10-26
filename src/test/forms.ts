/** FormData builders for action DB tests. */
export function form(
  fields: Record<string, string | string[] | undefined>,
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

let n = 0;

/** A valid post form; override any field. */
export function postForm(
  overrides: Record<string, string | string[] | undefined> = {},
): FormData {
  n += 1;
  return form({
    type: "MINISTRY_UPDATE",
    titleEn: `Admin post ${n}`,
    titleNe: "",
    slug: `admin-post-${Date.now().toString(36)}-${n}`,
    excerptEn: "An excerpt",
    excerptNe: "",
    bodyEn: "Body **text**",
    scriptureRefs: "John 3:16",
    publishedAt: "",
    intent: "draft",
    ...overrides,
  });
}
