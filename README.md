# Sarathi

**An independent hackathon prototype reimagining income tax e-filing for salaried
taxpayers in India. Not affiliated with the Income Tax Department, and not the
official e-filing portal.**

Every taxpayer detail in this app is synthetic. Every tax figure is computed
live from published FY 2025-26 rules.

---

## Run it

```bash
bun install
cp .env.example .env.local     # then paste your Gemini key into it
bun run dev
```

Open http://localhost:3000, sign in with the pre-filled PAN and any six-digit
OTP. No account is created and nothing leaves your browser except copilot
messages.

Without a `GEMINI_API_KEY` everything works except the copilot, which says so
plainly instead of failing silently. Get a key at
<https://aistudio.google.com/apikey>.

---

## What is here

Eighteen areas, all navigable, all doing something real.

| Tier | Module | Route |
| --- | --- | --- |
| 0 | Home dashboard | `/dashboard` |
| 0 | Income sources | `/income` |
| 0 | Salary and Form 16 | `/income/salary` |
| 0 | House property | `/income/house-property` |
| 0 | Other sources | `/income/other-sources` |
| 0 | AIS · TIS · 26AS reconciliation | `/reconciliation` |
| 0 | Deductions workspace | `/deductions` |
| 0 | Regime comparison and computation | `/regime` |
| 0 | Filing, form selection, review, submit | `/filing` |
| 0 | AI copilot | every screen |
| 1 | Auth | `/login`, `/register` |
| 1 | Profile and pre-filing setup | `/profile` |
| 1 | e-Verification | `/filing/everify` |
| 1 | Submission confirmation and ITR-V | `/filing/confirmation` |
| 1 | Filing history | `/history` |
| 1 | Refund tracker | `/refund` |
| 2 | Self-assessment tax payment | `/filing/payment` |
| 2 | Notices and e-Proceedings | `/notices` |
| 2 | Grievance redressal | `/grievance` |
| 2 | Help and glossary | `/help` |
| — | Capital gains, business income | honest out-of-scope screens |

---

## The tax engine

`lib/tax/` is pure, dependency-free functions. Nothing in the app hardcodes an
output figure — change any input anywhere and every number on every screen
moves.

Implemented against **FY 2025-26 / Assessment Year 2026-27** (Finance Act 2025):

- New regime slabs (₹4L / ₹8L / ₹12L / ₹16L / ₹20L / ₹24L) and old regime
  slabs, including the senior and super-senior tables
- Standard deduction — ₹75,000 new, ₹50,000 old
- HRA exemption under section 10(13A), least of three, with the metro / non-metro
  split applied correctly (Bengaluru is a non-metro, so 40%)
- House property under sections 22–24: gross annual value, municipal taxes, the
  flat 30% standard deduction, loan interest, the ₹2,00,000 set-off cap — and
  the fact that the new regime disallows the loss entirely
- Chapter VI-A with real per-section ceilings, and 80CCD(2) surviving into the
  new regime at 14% of basic instead of 10%
- Section 87A rebate **with marginal relief**, so income just above ₹12,00,000
  never pays more extra tax than the extra income
- Surcharge with marginal relief at each threshold, capped at 25% in the new
  regime
- 4% health and education cess, and rounding under section 288A
- Break-even shelter, solved numerically rather than looked up: how much
  old-regime relief you would need before the old regime wins at your income
- ITR-1 eligibility, checked against eight real disqualifying conditions

---

## The copilot

A panel present on every screen, wired to **Gemini function calling**.

Each turn it is handed a structured snapshot of the live app state — the module
you are in, your computed figures, your unresolved AIS mismatches, where you are
in the filing flow — built by `lib/copilot/context.ts`. It answers from that,
never from a canned phrase table.

Seven tools, all of which mutate the same Zustand store the screens read from:

| Tool | What it actually does |
| --- | --- |
| `navigate_to(module)` | routes the app |
| `switch_regime(regime)` | changes the regime and every dependent figure |
| `add_deduction(section, amount)` | records a Chapter VI-A section |
| `resolve_mismatch(item_id, resolution)` | settles an AIS gap and moves the income and TDS credit |
| `explain_term(term)` | opens the platform's own glossary entry |
| `raise_grievance(topic)` | creates a tracked ticket |
| `check_refund_status()` | reads the refund pipeline |

The turn is a proper two-phase loop: the model asks for tools, the client runs
them against real state, the results are replayed to the model as
`functionResponse` parts, and the model writes its reply knowing what actually
happened. Every action raises a visible toast and lands in the activity log on
`/profile`, so cause and effect is legible to someone watching the screen.

The API key lives only in `app/api/chat/route.ts`, server-side. The browser
talks to `/api/chat` and never to Google.

---

## Honesty — what is real, what is simulated

Also rendered in-app at `/help#about`.

**Real**

- All tax computation, as above. Recomputed from a single source of truth.
- The old-versus-new comparison, computed twice on the same inputs.
- State management: one Zustand store shared by every screen and by the copilot,
  persisted to `localStorage`.
- The copilot's tool calls. When it says it switched your regime, it called the
  same function the button calls.

**Simulated**

- The taxpayer. Ananya Verma does not exist. PAN is the documentation
  placeholder `ABCDE1234F`; employer, banks and landlord are invented.
- Login and OTP. No authentication happens; any six digits work.
- Form 16, AIS, TIS and 26AS — hand-written seed data, including one deliberate
  mismatch so the reconciliation module has something real to resolve.
- Submission. Nothing is transmitted anywhere; the acknowledgement number is
  generated locally. The downloadable ITR-V is plain text, marked synthetic on
  every line, and deliberately does not imitate a government PDF.
- Payment. No gateway is contacted and no payment detail is collected.
- Refund tracker timings, which advance on a short simulated clock.
- Persistence. There is no database — state lives in the browser.

**Assumptions**

- Assessment Year 2026-27 (FY 2025-26) throughout, noted in
  `lib/tax/constants.ts`.
- Resident individual, salaried. The code handles the age-60 and age-80 slab
  tables; the seeded persona is 33.
- Capital gains and business income are out of scope and say so on their own
  screens rather than pretending.

---

## The demo path

1. Sign in — pre-filled PAN, any six digits.
2. **Income → Salary** — import the Form 16. ₹18,40,000 gross, ₹2,45,000 already
   deducted.
3. **AIS · TIS · 26AS** — three unresolved gaps. Fixed deposit interest of
   ₹42,300 that never made it into the return, a dividend under-declared by
   ₹2,400, and a joint-account entry that belongs to someone else. Settle all
   three; the income and the TDS credit both move.
4. **Deductions** — answer the guided questions instead of hunting for sections.
5. **Regime** — the recommendation flips from new to old once the deductions are
   in, and the working is shown line by line.
6. **File → e-Verify → Refund tracker.**

At any point, open the copilot and tell it to do one of those steps instead.

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Zustand · Bun ·
Gemini via a server-side route handler. No database.
