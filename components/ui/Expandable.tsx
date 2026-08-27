"use client";

import { useState } from "react";

import { cx } from "@/components/ui";

/**
 * Progressive disclosure for the explanatory prose.
 *
 * These screens explain themselves deliberately — a difference the user does
 * not understand is a difference they will not settle. But three cards each
 * carrying a full paragraph is a wall of text, and a wall of text gets skipped
 * whole, which loses the explanation anyway.
 *
 * So: the sentence that says what happened stays visible, and the rest — why
 * it happened, what it costs — is one tap away and stays where it was written
 * rather than being cut.
 */
export function Expandable({
  text,
  more = "Why this matters",
  less = "Less",
  className,
}: {
  text: string;
  more?: string;
  less?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [lead, rest] = splitLead(text);

  if (!rest) return <p className={className}>{text}</p>;

  return (
    <p className={className}>
      {lead}{" "}
      {open ? <span className="animate-rise">{rest} </span> : null}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cx(
          "whitespace-nowrap border-b border-[color:var(--plum-line)] font-medium text-[color:var(--plum)]",
          "hover:border-[color:var(--plum)]",
        )}
      >
        {open ? less : more}
      </button>
    </p>
  );
}

/**
 * First sentence, then the remainder. Only splits when the lead can stand on
 * its own — a six-word opener followed by a hidden paragraph would be worse
 * than showing the lot.
 */
export function splitLead(text: string): [string, string | null] {
  const match = /^([\s\S]*?[.!?])\s+([\s\S]+)$/.exec(text.trim());
  if (!match) return [text, null];
  const [, lead, rest] = match;
  if (lead.length < 45 || rest.length < 40) return [text, null];
  return [lead, rest];
}
