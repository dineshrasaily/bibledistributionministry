import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/Card";

/** Titled card grouping related fields in an editor. */
export function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-visible">
      <CardBody className="gap-5">
        <h2 className="font-serif text-xl font-semibold text-navy">{title}</h2>
        {children}
      </CardBody>
    </Card>
  );
}
