/**
 * The Layora mark: a rounded purple square with a white L.
 *
 * One definition, used everywhere — the tab icon, the landing page, the
 * workspace sidebar, the sign-in screen, the loading splash, the legal pages.
 *
 * The colour is fixed rather than themed, and that is the whole point of this
 * component existing. Every one of those places used to draw the mark inline,
 * and most of them reached for `bg-primary`, which is the *student's chosen
 * accent* — blue by default. So the logo was blue for one student, green for
 * another, and purple only for someone who had picked the purple theme, while
 * the landing page hardcoded purple and the icon files were a purple-to-cyan
 * gradient. A brand mark that changes with a user preference is not a brand
 * mark. MARK_PURPLE is the same value the icon route and the generated PNGs
 * use; change it in all four places together or they drift apart again.
 */

export const MARK_PURPLE = '#C56BF5';

/**
 * Corner softness as a share of the side, which is the only way it stays the
 * same shape at every size. Tailwind's radius classes cannot: this project
 * sets `--radius-md` to 0.75rem, so `rounded-md` on the 24px sidebar mark came
 * out at 12px — a perfect circle — while the same class on a 56px mark looked
 * square. Matches the 0.22 used by scripts/generate-logos.py.
 */
const MARK_RADIUS = '22%';

interface LayoraMarkProps {
  /** Sizing only, e.g. "h-6 w-6". Radius is handled here, not by the caller. */
  className?: string;
  /** Tailwind text sizing for the glyph, e.g. "text-[11px]". */
  glyphClassName?: string;
}

export default function LayoraMark({
  className = 'h-6 w-6',
  glyphClassName = 'text-[11px]',
}: LayoraMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ backgroundColor: MARK_PURPLE, borderRadius: MARK_RADIUS }}
    >
      <span className={`font-bold leading-none tracking-tighter text-white ${glyphClassName}`}>
        L
      </span>
    </span>
  );
}
