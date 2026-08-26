import { resume } from "@/content/resume";
import { site } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">
          &copy; {new Date().getFullYear()} {site.name}
        </p>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {resume.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted hover:text-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
