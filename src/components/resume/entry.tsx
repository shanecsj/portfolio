import type { ReactNode } from "react";

/**
 * One row of a resume: a title/subtitle pair, a date range pinned to the
 * right on wide screens, and optional bullets. Shared by Experience and
 * Education so the two never drift apart visually.
 */
export function Entry({
  title,
  subtitle,
  href,
  meta,
  dates,
  bullets,
  children,
}: {
  title: string;
  subtitle: string;
  href?: string;
  meta?: string;
  dates: string;
  bullets?: string[];
  children?: ReactNode;
}) {
  return (
    <article className="mt-7 first:mt-0">
      <div className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base leading-snug font-semibold text-ink">
          {title}
          <span className="text-muted font-normal"> · </span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-normal text-muted decoration-rule underline-offset-4 hover:text-accent hover:decoration-accent hover:underline"
            >
              {subtitle}
            </a>
          ) : (
            <span className="font-normal text-muted">{subtitle}</span>
          )}
        </h3>
        <p className="shrink-0 font-mono text-xs text-faint tabular-nums">
          {dates}
        </p>
      </div>

      {meta ? <p className="mt-1 text-sm text-faint">{meta}</p> : null}

      {bullets && bullets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="relative pl-5 text-sm leading-relaxed text-muted before:absolute before:left-0 before:text-faint before:content-['—']"
            >
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </article>
  );
}
