/**
 * The jargon that keeps showing up on this platform, in plain language.
 * Rendered on the Help page, used by the inline <Term> tooltip, and given to
 * the copilot as source material for explain_term().
 */

export type GlossaryEntry = {
  term: string;
  aliases?: string[];
  short: string;
  long: string;
  category: "Documents" | "Sections" | "Process" | "Money";
};

export const glossary: GlossaryEntry[] = [
  {
    term: "AIS",
    aliases: ["Annual Information Statement"],
    category: "Documents",
    short:
      "A list of everything banks, employers and companies told the tax department about your money this year.",
    long: "The Annual Information Statement is the department's copy of your financial year. Banks report your interest, companies report dividends paid to you, your employer reports salary, registrars report property purchases. You never filled any of it in — it arrives from third parties. Its job is to let you check your return against what the department already knows. Where you disagree with an entry, you submit feedback on that entry rather than arguing about it later.",
  },
  {
    term: "TIS",
    aliases: ["Taxpayer Information Summary"],
    category: "Documents",
    short:
      "The AIS boiled down to one number per category, after your feedback is applied.",
    long: "The Taxpayer Information Summary sits on top of the AIS. Where the AIS lists every individual transaction, the TIS shows one total per head of income — all your interest as a single figure, all your dividends as a single figure. It carries three values per row: what was reported, what survived the department's de-duplication, and what it becomes once your feedback is processed. The derived value is what feeds into your prefilled return.",
  },
  {
    term: "Form 26AS",
    aliases: ["26AS"],
    category: "Documents",
    short: "Your tax credit statement — proof of tax already paid on your behalf.",
    long: "Form 26AS is the ledger of tax already deposited against your PAN: TDS cut by your employer, TDS cut by your bank on deposits, advance tax you paid yourself, and any refunds already issued. It matters because you can only claim credit for tax that actually shows up here. If your employer deducted tax but never deposited it, 26AS is where that becomes visible.",
  },
  {
    term: "Form 16",
    category: "Documents",
    short: "The salary and TDS certificate your employer gives you each year.",
    long: "Form 16 comes in two parts. Part A is the TDS summary — how much tax your employer deducted and deposited each quarter. Part B is the salary breakup — basic, HRA, allowances, the exemptions your employer already accounted for, and the deductions you declared to them. Most of a salaried return can be filled from this one document.",
  },
  {
    term: "Form 10-IEA",
    category: "Documents",
    short:
      "The form you file to opt out of the new tax regime and use the old one.",
    long: "Since the new regime became the default, choosing the old regime is an active decision. A salaried person with no business income can simply select the old regime while filing and does not need Form 10-IEA. Anyone with business or professional income does have to file Form 10-IEA before the return due date to opt out, and can only switch back once in their lifetime.",
  },
  {
    term: "ITR-1",
    aliases: ["Sahaj"],
    category: "Documents",
    short:
      "The simplest return form — for salaried residents with income up to ₹50 lakh and one house property.",
    long: "ITR-1 is for a resident individual with total income up to ₹50 lakh made up of salary or pension, one house property, and other sources such as interest. From AY 2025-26 it also allows long-term capital gains under section 112A up to ₹1.25 lakh. It cannot be used if you have more than one house property, a loss to carry forward, income from business, foreign assets, or if you are a company director.",
  },
  {
    term: "ITR-2",
    category: "Documents",
    short:
      "The next form up — when you have capital gains, more than one property, or foreign assets.",
    long: "ITR-2 covers an individual or Hindu Undivided Family without business or professional income. Reach for it when ITR-1 runs out: capital gains beyond the small 112A allowance, two or more house properties, losses to carry forward, foreign income or assets, agricultural income above ₹5,000, or if you are a director in a company.",
  },
  {
    term: "ITR-V",
    category: "Documents",
    short: "The one-page acknowledgement that proves you filed.",
    long: "ITR-V stands for Income Tax Return - Verification. It is generated the moment you submit. If you e-verify with an Aadhaar OTP, the ITR-V is just your receipt. If you do not e-verify, you have to print it, sign it in blue ink and post it to the Centralised Processing Centre in Bengaluru within 30 days, or the return is treated as never filed.",
  },
  {
    term: "Section 87A",
    aliases: ["87A", "rebate"],
    category: "Sections",
    short:
      "A rebate that wipes out your tax entirely if your income is below the threshold.",
    long: "Section 87A is a rebate, not a deduction — it comes off the tax, not off the income. Under the new regime for FY 2025-26, if your total income is ₹12,00,000 or less the rebate can be up to ₹60,000, which in practice means zero tax. Under the old regime the threshold is ₹5,00,000 and the rebate is up to ₹12,500. Cross the new-regime line by a small amount and marginal relief kicks in so you never pay more extra tax than the extra income you earned.",
  },
  {
    term: "Marginal relief",
    category: "Money",
    short:
      "A safety valve so earning ₹1 more never costs you ₹1,000 more in tax.",
    long: "Without marginal relief, income of ₹12,00,000 would attract no tax under the new regime while ₹12,10,000 would attract around ₹61,500 — a ₹10,000 raise costing far more than it is worth. Marginal relief caps the tax so that it can never exceed the amount by which you crossed the rebate threshold. The same idea applies at the surcharge thresholds of ₹50 lakh and ₹1 crore.",
  },
  {
    term: "Section 80C",
    aliases: ["80C"],
    category: "Sections",
    short:
      "Up to ₹1.5 lakh off your income for savings like EPF, ELSS, life insurance and home loan principal.",
    long: "Section 80C is the workhorse deduction of the old regime, with a combined ceiling of ₹1,50,000. It covers employee provident fund, public provident fund, ELSS mutual funds, life insurance premiums, five-year tax-saving deposits, National Savings Certificates, Sukanya Samriddhi, tuition fees for up to two children, and the principal portion of a home loan. It is unavailable under the new regime.",
  },
  {
    term: "Section 80CCD(2)",
    aliases: ["80CCD(2)", "employer NPS"],
    category: "Sections",
    short:
      "The one big deduction that survives in the new regime — your employer's NPS contribution.",
    long: "When your employer puts money into your National Pension System account, that contribution is deductible under section 80CCD(2), and unusually it works under both regimes. The ceiling is 14% of basic salary under the new regime and 10% under the old one. This is why the new regime often wins for people whose employer offers NPS: it is the only meaningful shelter left, and it is more generous there.",
  },
  {
    term: "Section 80D",
    aliases: ["80D"],
    category: "Sections",
    short: "Health insurance premiums — up to ₹25,000 for you, plus more for parents.",
    long: "Section 80D allows the premium you pay for health cover: ₹25,000 for yourself, your spouse and children, rising to ₹50,000 if you are a senior citizen. On top of that you can claim premiums paid for your parents — another ₹25,000, or ₹50,000 if they are senior citizens. Preventive health check-ups count for ₹5,000 within those limits, and can be paid in cash. Old regime only.",
  },
  {
    term: "Section 80TTA",
    aliases: ["80TTA"],
    category: "Sections",
    short: "The first ₹10,000 of savings account interest, tax free.",
    long: "Section 80TTA exempts up to ₹10,000 of interest from savings bank accounts. It is easy to get wrong in two ways: it does not cover fixed deposit or recurring deposit interest, and it is not available under the new regime. Senior citizens use section 80TTB instead, which is more generous at ₹50,000 and does cover deposits.",
  },
  {
    term: "HRA",
    aliases: ["House Rent Allowance", "Section 10(13A)"],
    category: "Sections",
    short:
      "Part of your rent allowance is tax free — the smallest of three calculations.",
    long: "The House Rent Allowance exemption under section 10(13A) is the least of three figures: the HRA actually in your salary, the rent you paid minus 10% of basic salary, and 50% of basic salary if you live in Delhi, Mumbai, Kolkata or Chennai (40% everywhere else). You must actually pay rent, and if annual rent crosses ₹1,00,000 you need your landlord's PAN. Old regime only.",
  },
  {
    term: "Standard deduction",
    category: "Money",
    short:
      "A flat amount taken off salary with no bills or proof required — ₹75,000 in the new regime.",
    long: "The standard deduction is subtracted from salary income automatically, no receipts involved. For FY 2025-26 it is ₹75,000 under the new regime and ₹50,000 under the old regime. Pensioners get it too. It is the reason a new-regime salary of ₹12,75,000 can still land at zero tax once section 87A is applied.",
  },
  {
    term: "TDS",
    aliases: ["Tax Deducted at Source"],
    category: "Money",
    short: "Tax someone else already cut from your money and paid to the government.",
    long: "Tax Deducted at Source means the payer withholds tax before paying you — your employer from salary, your bank from deposit interest above ₹50,000 (₹1,00,000 for senior citizens), a company from dividends above ₹10,000. It is not a separate tax; it is an advance against your final bill. Whatever was deducted shows up in Form 26AS and is set off against what you owe, with any excess refunded.",
  },
  {
    term: "Cess",
    aliases: ["Health and Education Cess"],
    category: "Money",
    short: "A flat 4% added on top of your tax, earmarked for health and education.",
    long: "The Health and Education Cess is 4% charged on the income tax plus surcharge, not on your income. It applies under both regimes and to everyone, with no threshold and no exemption. It is the last line in the calculation before you compare against tax already paid.",
  },
  {
    term: "Surcharge",
    category: "Money",
    short: "An extra percentage on the tax itself, once income crosses ₹50 lakh.",
    long: "Surcharge is levied on the tax amount, not the income: 10% above ₹50 lakh, 15% above ₹1 crore, 25% above ₹2 crore and 37% above ₹5 crore. The new regime caps it at 25%. Marginal relief applies at each threshold so crossing a line by a small amount does not cost more than the amount by which you crossed it.",
  },
  {
    term: "Gross Total Income",
    category: "Money",
    short: "Everything you earned across all five heads, before Chapter VI-A deductions.",
    long: "Gross Total Income is the sum of income under the five heads — salary, house property, business or profession, capital gains, and other sources — after each head has had its own deductions applied and after losses have been set off. Chapter VI-A deductions such as 80C and 80D then come off this figure to give Total Income, which is what the slabs are applied to.",
  },
  {
    term: "Self-assessment tax",
    category: "Money",
    short: "Tax you pay yourself at filing time, when TDS did not cover the whole bill.",
    long: "If your total liability exceeds the tax already deducted and any advance tax paid, the shortfall is self-assessment tax under section 140A. You pay it before submitting the return and quote the challan details in the return itself. Interest under sections 234B and 234C may be added if the shortfall was large enough that you should have been paying advance tax during the year.",
  },
  {
    term: "Advance tax",
    category: "Money",
    short: "Paying as you earn, in four instalments, when your bill exceeds ₹10,000.",
    long: "If your tax for the year after TDS will exceed ₹10,000, you are meant to pay it in instalments during the year: 15% by 15 June, 45% by 15 September, 75% by 15 December and 100% by 15 March. Salaried people usually satisfy this through TDS alone, but a large amount of interest or dividend income can push you into advance tax territory. Missing the instalments attracts interest under section 234C.",
  },
  {
    term: "Section 234A",
    aliases: ["234A", "Interest for filing late"],
    category: "Sections",
    short: "1% a month on unpaid tax, for every month you file after the due date.",
    long: "Section 234A charges interest at 1% for every month, or part of a month, between the due date and the day you actually file — but only on tax still unpaid at the due date. Someone owed a refund pays nothing under this section however late they are. It stacks on top of 234B and 234C rather than replacing them, and it is calculated on the unpaid amount rounded down to the nearest ₹100.",
  },
  {
    term: "Section 234B",
    aliases: ["234B"],
    category: "Sections",
    short: "1% a month when advance tax and TDS together covered less than 90% of the bill.",
    long: "If the tax left after TDS was more than 10% of what you owed, section 234B charges 1% a month on that whole shortfall, running from 1 April of the assessment year until you file. Most salaried people never meet it, because TDS on salary covers the bill. It appears when a large amount of interest or capital gains arrives that nobody withheld enough on — and it keeps running until the return is filed, so filing sooner costs less.",
  },
  {
    term: "Section 234C",
    aliases: ["234C"],
    category: "Sections",
    short: "Interest for reaching each advance tax instalment date with too little paid.",
    long: "Advance tax is due in four instalments — 15% by 15 June, 45% by 15 September, 75% by 15 December and 100% by 15 March. Section 234C looks at each date separately and charges 1% a month on whatever was short: three months at each of the first three dates, one month at the last. Paying 12% and 36% at the first two dates is accepted without interest. Unlike 234B it stops running when the year ends, so it cannot be reduced by filing early.",
  },
  {
    term: "Section 234F",
    aliases: ["234F", "Late filing fee"],
    category: "Sections",
    short: "A flat ₹5,000 fee for filing after the due date — ₹1,000 on small incomes.",
    long: "Section 234F is a fee, not interest: it does not grow with time and it does not depend on how much tax you owe. File one day late with a refund coming to you and it still applies, reducing the refund. It is ₹1,000 where total income is ₹5,00,000 or less and ₹5,000 otherwise. It is the cheapest of the late charges to avoid, because avoiding it takes nothing but filing on time.",
  },
  {
    term: "Assessment Year",
    aliases: ["AY"],
    category: "Process",
    short: "The year you file in. Always one year after the year you earned in.",
    long: "Income earned between 1 April 2025 and 31 March 2026 belongs to Financial Year 2025-26, and is assessed in Assessment Year 2026-27. Nearly every form, notice and deadline is labelled with the assessment year, which is why it looks like you are filing for a year that has not happened yet.",
  },
  {
    term: "e-Verification",
    category: "Process",
    short:
      "The step that makes your filed return real. Thirty days, or it never counted.",
    long: "Submitting a return is not the end of it — an unverified return is treated as though it was never filed. You have 30 days from submission to verify, most easily with an OTP sent to the mobile number linked to your Aadhaar. Net banking, a bank account EVC, a demat EVC and a physical signed ITR-V by post all work too. Refund processing only begins after verification.",
  },
  {
    term: "Intimation u/s 143(1)",
    aliases: ["143(1)"],
    category: "Process",
    short:
      "The department's automated reply after it checks your arithmetic. Usually harmless.",
    long: "After processing, the Centralised Processing Centre sends an intimation under section 143(1) showing your figures side by side with theirs. Three outcomes are possible: they agree and nothing happens, they agree and a refund is determined, or they disagree and a demand is raised. It is a computer comparison, not an audit, and most differences come from a deduction claimed in the return that the department could not see evidence for.",
  },
  {
    term: "Set-off and carry forward",
    category: "Process",
    short:
      "Using a loss in one place to reduce income somewhere else — and saving the rest for later.",
    long: "A loss under one head can often be set off against income under another in the same year. A loss from house property, typically caused by home loan interest exceeding rent, can be set off against salary but only up to ₹2,00,000 in a year. Whatever is left over is carried forward for up to eight years, and can then only be set off against house property income. Carrying a loss forward requires filing the return by the due date.",
  },
  {
    term: "Let-out property",
    category: "Process",
    short: "A house you rent out — taxed on the rent, after a flat 30% allowance.",
    long: "For a let-out property, the rent received is the gross annual value. You subtract municipal taxes actually paid to get the net annual value, then a flat 30% of that as a standard deduction for repairs and maintenance whether or not you spent anything, then the full home loan interest with no ceiling. The result is often a loss, which is exactly why letting a property out is treated differently from living in it.",
  },
];

export function findGlossaryEntry(query: string): GlossaryEntry | undefined {
  const q = query.trim().toLowerCase().replace(/^section\s+/, "");
  return glossary.find((entry) => {
    const names = [entry.term, ...(entry.aliases ?? [])].map((n) =>
      n.toLowerCase().replace(/^section\s+/, ""),
    );
    return names.some((n) => n === q || n.includes(q) || q.includes(n));
  });
}
