"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { site } from "@/config/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-5"
      >
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink hover:text-accent"
        >
          {site.name}
        </Link>

        {/* Hidden until there is more than one destination to choose between. */}
        {NAV_ITEMS.length > 1 ? (
          <ul className="flex items-center gap-5">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "text-sm font-medium text-ink"
                        : "text-sm text-muted hover:text-ink"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </nav>
    </header>
  );
}
