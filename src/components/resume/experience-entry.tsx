import { Bullets } from "@/components/resume/bullets";
import type { ExperienceItem } from "@/content/resume";

/**
 * One organisation and every role held there. Grouping by org keeps a
 * promotion readable as one continuous stint rather than two unrelated jobs.
 */
export function ExperienceEntry({ item }: { item: ExperienceItem }) {
  return (
    <article className="mt-9 first:mt-0">
      <div className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base leading-snug font-semibold text-ink">
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="decoration-rule underline-offset-4 hover:text-accent hover:decoration-accent hover:underline"
            >
              {item.org}
            </a>
          ) : (
            item.org
          )}
        </h3>
        <p className="shrink-0 font-mono text-xs text-faint tabular-nums">
          {item.start} — {item.end}
        </p>
      </div>

      {item.location ? (
        <p className="mt-1 text-sm text-faint">{item.location}</p>
      ) : null}

      <div className="mt-4 space-y-5">
        {item.roles.map((role) => (
          <div key={role.title}>
            <h4 className="text-sm font-medium text-ink">{role.title}</h4>
            <Bullets items={role.bullets} />
          </div>
        ))}
      </div>
    </article>
  );
}
