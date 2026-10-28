import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";

export type ToolbarFilter = {
  name: string;
  label: string;
  value?: string;
  options: readonly { value: string; label: string }[];
  /** Text of the empty option (default "All"); null = no empty option. */
  allLabel?: string | null;
};

/** Plain GET form (works without JavaScript); values mirror searchParams. */
export function ListToolbar({
  action,
  q,
  filters = [],
  search = true,
  searchLabel = "Search",
}: {
  action: string;
  q?: string;
  filters?: ToolbarFilter[];
  search?: boolean;
  searchLabel?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label="Filter the list"
      className="mb-6 flex flex-col gap-4 rounded-lg border border-beige bg-white p-4 md:flex-row md:flex-wrap md:items-end"
    >
      {search ? (
        <div className="min-w-0 md:min-w-[14rem] md:flex-1">
          <Label htmlFor="list-q">{searchLabel}</Label>
          <Input
            id="list-q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            className="mt-1.5"
          />
        </div>
      ) : null}
      {filters.map((filter) => (
        <div key={filter.name} className="md:w-48">
          <Label htmlFor={`list-${filter.name}`}>{filter.label}</Label>
          <Select
            id={`list-${filter.name}`}
            name={filter.name}
            defaultValue={filter.value ?? ""}
            className="mt-1.5"
          >
            {filter.allLabel === null ? null : (
              <option value="">{filter.allLabel ?? "All"}</option>
            )}
            {filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
