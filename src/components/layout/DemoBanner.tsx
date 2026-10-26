export function DemoBanner({ text }: { text: string }) {
  return (
    <div
      role="note"
      data-demo-banner=""
      className="border-b border-gold/30 bg-beige px-5 py-1.5 text-center text-sm text-navy"
    >
      <p className="inline-flex items-center gap-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-gold-dark"
          fill="none"
        >
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 9v5M10 6.2v.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {text}
      </p>
    </div>
  );
}
