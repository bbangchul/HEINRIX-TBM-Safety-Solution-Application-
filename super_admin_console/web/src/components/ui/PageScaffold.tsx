import type { ReactNode } from "react";

interface PageScaffoldProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageScaffold({ title, description, children }: PageScaffoldProps) {
  return (
    <section className="page-scaffold">
      <header className="page-scaffold-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="page-scaffold-body">{children}</div>
    </section>
  );
}
