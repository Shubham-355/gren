"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cx } from "@/components/ui";

/**
 * Six boxes, one value. Used at sign-in and again at e-verification, so the
 * gesture is the same in both places.
 *
 * Everything about it is simulated — any six digits are accepted and nothing
 * is sent to a real number.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  size = "md",
}: {
  value: string;
  onChange: (next: string) => void;
  /** receives the finished six digits — the caller's state has not updated yet */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function write(index: number, char: string) {
    const next = value.padEnd(6, " ").split("");
    next[index] = char;
    const joined = next.join("").replace(/\s+$/, "");
    onChange(joined.trimEnd());
    if (char && index < 5) refs.current[index + 1]?.focus();
    const finished = joined.replace(/\s/g, "");
    if (char && index === 5 && finished.length === 6) {
      onComplete?.(finished);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !digits[index].trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) onComplete?.(pasted);
  }

  return (
    <div className="flex gap-2" role="group" aria-label="One-time password">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d.trim()}
          inputMode="numeric"
          maxLength={1}
          size={1}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onPaste={onPaste}
          onKeyDown={(e) => onKeyDown(e, i)}
          onChange={(e) => write(i, e.target.value.replace(/\D/g, "").slice(-1))}
          className={cx(
            // min-w-0: an <input> has an intrinsic width from its size
            // attribute, and without this the six boxes refuse to shrink and
            // push the card off the side of the screen.
            "mono w-full min-w-0 flex-1 rounded-[11px] border bg-surface text-center text-ink transition-colors",
            size === "lg" ? "h-[60px] text-[22px]" : "h-[56px] text-[21px]",
            d.trim()
              ? "border-line-strong"
              : "border-line-strong bg-raised",
            "focus:border-[1.5px] focus:border-[color:var(--plum)] focus:outline-none",
          )}
        />
      ))}
    </div>
  );
}
