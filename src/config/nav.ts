/**
 * Site navigation. Adding a new page to the nav is one entry here —
 * see src/app/hello/page.tsx for the page template.
 */
export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Resume" },
  { href: "/eatwhat", label: "Eat what" },
];
