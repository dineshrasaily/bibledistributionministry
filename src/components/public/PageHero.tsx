import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

/** Beige radial band with the page h1 (shared by the Phase 3 pages). */
export function PageHero({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  badge?: ReactNode;
}) {
  return (
    <section className="bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,var(--color-beige)_0%,transparent_75%)] pt-16 pb-12 md:pt-24 md:pb-16">
      <Container className="flex flex-col items-center gap-5 text-center">
        <SectionHeader
          as="h1"
          align="center"
          eyebrow={eyebrow}
          title={title}
          description={description ?? undefined}
        />
        {badge}
      </Container>
    </section>
  );
}
