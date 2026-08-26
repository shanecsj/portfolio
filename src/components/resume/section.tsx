import type { ReactNode } from "react";

/**
 * A titled resume section. Renders nothing when it has no children, so the
 * page can hand it an empty list without leaving a stray heading behind.
 */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-5 text-xs font-semibold tracking-[0.14em] text-faint uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
