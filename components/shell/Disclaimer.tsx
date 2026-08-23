import Link from "next/link";

/**
 * Required on every screen. This is a student prototype and must never be
 * mistaken for the real thing.
 */
export function Disclaimer({ inset = false }: { inset?: boolean }) {
  return (
    <footer
      className={
        inset
          ? "border-t border-line px-4 py-5 text-center"
          : "mt-auto border-t border-line px-4 py-4 pb-24 text-center lg:pb-5"
      }
    >
      <p className="mx-auto max-w-2xl text-[11.5px] leading-relaxed text-ink-faint">
        Independent hackathon prototype — not affiliated with the Income Tax
        Department, and not the official e-filing portal. Every taxpayer detail
        here is synthetic. Tax figures are computed live from published FY
        2025-26 rules, but nothing on this site constitutes tax advice.{" "}
        <Link href="/help#about" className="underline underline-offset-2">
          How this prototype works
        </Link>
      </p>
    </footer>
  );
}
