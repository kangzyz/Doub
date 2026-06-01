import { useId } from "react";

/**
 * DOUB wordmark — the canonical repo logo (frontend/public/logo.svg).
 * Rendered inline with `fill: currentColor` so it adapts to the theme
 * (white on dark, near-black on light); colour it via `text-*`.
 * The diagonal-stripe mask is the brand's signature texture; at small
 * sizes it reads as a clean solid wordmark.
 */
export function DoubLogo({
  className,
  title = "DOUB",
}: {
  className?: string;
  title?: string;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stripes = `doub-stripes-${raw}`;
  const letters = `doub-letters-${raw}`;
  const mask = `doub-mask-${raw}`;

  return (
    <svg
      viewBox="0 0 425 170"
      role="img"
      aria-label={title}
      className={className}
      fill="currentColor"
    >
      <defs>
        <pattern
          id={stripes}
          patternUnits="userSpaceOnUse"
          width="18"
          height="18"
          patternTransform="rotate(-45)"
        >
          <rect width="18" height="18" fill="white" />
          <rect width="1.2" height="18" fill="black" />
        </pattern>
        <g id={letters} fillRule="evenodd">
          <path d="M 21 22 L 55 22 Q 110 22 110 85 Q 110 148 55 148 L 15 148 L 15 28 Z M 43 50 L 55 50 Q 82 50 82 85 Q 82 120 55 120 L 43 120 Z" />
          <path d="M 168 22 Q 218 22 218 85 Q 218 148 168 148 Q 118 148 118 85 Q 118 22 168 22 Z M 168 50 Q 146 50 146 85 Q 146 120 168 120 Q 190 120 190 85 Q 190 50 168 50 Z" />
          <path d="M 232 22 L 254 22 L 254 108 Q 254 120 268 120 Q 282 120 282 108 L 282 22 L 304 22 L 310 28 L 310 108 Q 310 148 268 148 Q 226 148 226 108 L 226 28 Z" />
          <path d="M 324 22 L 373 22 Q 410 22 410 52 Q 410 72 396 80 Q 410 88 410 110 Q 410 148 373 148 L 318 148 L 318 28 Z M 346 50 L 366 50 Q 383 50 383 56 Q 383 70 366 70 L 346 70 Z M 346 90 L 366 90 Q 386 90 386 110 Q 386 120 366 120 L 346 120 Z" />
        </g>
        <mask id={mask}>
          <use href={`#${letters}`} fill={`url(#${stripes})`} />
        </mask>
      </defs>
      <rect width="425" height="170" fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}
