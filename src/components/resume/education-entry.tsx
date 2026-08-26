import type { EducationItem } from "@/content/resume";

export function EducationEntry({ item }: { item: EducationItem }) {
  return (
    <article className="mt-7 first:mt-0">
      <div className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base leading-snug font-semibold text-ink">
          {item.credential}
        </h3>
        <p className="shrink-0 font-mono text-xs text-faint tabular-nums">
          {item.start} — {item.end}
        </p>
      </div>

      <p className="mt-1 text-sm text-muted">{item.org}</p>

      {item.detail ? (
        <p className="mt-1 text-sm text-faint">{item.detail}</p>
      ) : null}
    </article>
  );
}
