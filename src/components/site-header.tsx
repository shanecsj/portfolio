"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { site } from "@/config/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
      {/* Full-width rather than centred on the content column, so the handle
          sits hard against the left gutter. py-3 keeps the bar the same height
          as before now that the script face is larger. */}
      <nav
        aria-label="Main"
        className="flex items-center justify-between gap-4 px-6 py-3 sm:px-12"
      >
        <Link
          href="/"
          /* No bold utility here — Pacifico has only weight 400. Default
             line-height leaves room for the descender on the trailing "j".
             Hover dims rather than switching colour, so it stays in the brand
             hue instead of jumping to the blue link accent. */
          className="font-script text-2xl text-brand transition-opacity hover:opacity-75"
        >
          {site.handle}
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
