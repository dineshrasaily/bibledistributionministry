import { formatDateTime } from "./labels";
import { StatusBadge } from "./StatusBadge";

/** Status badge + "Last updated …" under an editor's title. */
export function RecordMeta({
  status,
  updatedAt,
}: {
  status: string;
  updatedAt: Date;
}) {
  return (
    <span className="flex flex-wrap items-center gap-3 text-sm">
      <StatusBadge status={status} />
      <span>Last updated {formatDateTime(updatedAt)}</span>
    </span>
  );
}
