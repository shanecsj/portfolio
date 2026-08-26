/** Shared achievement list, so experience and education mark bullets alike. */
export function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="relative pl-5 text-sm leading-relaxed text-muted before:absolute before:left-0 before:text-faint before:content-['—']"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
