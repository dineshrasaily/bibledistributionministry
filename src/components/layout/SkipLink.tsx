export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      className="sr-only rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus-visible:outline-gold"
    >
      {label}
    </a>
  );
}
