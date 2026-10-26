import { notFound } from "next/navigation";

// Unknown /admin/* URLs render admin/not-found.tsx instead of falling through
// to the public [locale] catch-all. Renders nothing, so it needs no guard.
export default function AdminCatchAll() {
  notFound();
}
