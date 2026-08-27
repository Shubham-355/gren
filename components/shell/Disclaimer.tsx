import Link from "next/link";

import { SHELL_CONTAINER } from "./layout";

/**
 * Required on every screen. This is a hackathon prototype and must never be
 * mistaken for the real thing.
 */
export function Disclaimer({ inset = false }: { inset?: boolean }) {
  return (
    <footer
      className={
        inset
          ? "border-t border-line bg-sunk px-5 py-4"
          : "mt-auto border-t border-line bg-sunk py-4 pb-24 lg:pb-5"
      }
    >
      <p
        className={
          inset
            ? "text-[12px] leading-relaxed text-ink-faint"
            : `${SHELL_CONTAINER} text-[12px] leading-relaxed text-ink-faint`
        }
      >
        Independent hackathon prototype — not the official e-filing portal, not
        affiliated with the Income Tax Department. Every taxpayer detail here is
        synthetic; every tax figure is computed live from published FY 2025-26
        rules. Nothing on this site is tax advice.{" "}
        <Link
          href="/help#about"
          className="tap inline-block text-[color:var(--plum)] underline underline-offset-2"
        >
          What&rsquo;s real, what&rsquo;s mocked
        </Link>
      </p>
    </footer>
  );
}
