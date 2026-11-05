import Link from "next/link";

const TABS = [
  { href: "/mj", label: "Leaderboard" },
  { href: "/mj/zhahu", label: "诈胡" },
] as const;

/** Switches between the public /mj boards. */
export function MjTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Boards" className="mt-4 flex gap-5 border-b border-rule text-sm">
      {TABS.map((t) => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              active
                ? "border-brand font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
