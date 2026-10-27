/** Prominent "this is a template" note for the legal pages. */
export function TemplateNotice({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div
      role="note"
      data-testid="template-notice"
      className="rounded-lg border-2 border-gold-dark bg-white px-5 py-4 text-navy"
    >
      <p>
        <strong className="mr-2 inline-flex rounded-full bg-gold-dark px-2.5 py-0.5 text-xs font-semibold tracking-[0.08em] text-white uppercase">
          {label}
        </strong>
        {text}
      </p>
    </div>
  );
}
