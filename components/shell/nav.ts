export type NavItem = {
  href: string;
  label: string;
  short?: string;
  description: string;
  tier: 0 | 1 | 2;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Home",
        description: "Where your return stands and what needs doing",
        tier: 0,
      },
    ],
  },
  {
    title: "Prepare",
    items: [
      {
        href: "/income",
        label: "Income sources",
        short: "Income",
        description: "Salary, house property and everything else you earned",
        tier: 0,
      },
      {
        href: "/reconciliation",
        label: "AIS, TIS & 26AS",
        short: "Reconcile",
        description: "Check your return against what the department already knows",
        tier: 0,
      },
      {
        href: "/deductions",
        label: "Deductions",
        description: "Everything you can legitimately take off your income",
        tier: 0,
      },
      {
        href: "/regime",
        label: "Regime & tax",
        short: "Regime",
        description: "Old versus new, computed on your actual numbers",
        tier: 0,
      },
    ],
  },
  {
    title: "File",
    items: [
      {
        href: "/filing",
        label: "File your return",
        short: "File",
        description: "Pick the form, review the prefill, submit",
        tier: 0,
      },
      {
        href: "/filing/payment",
        label: "Pay tax due",
        description: "Self-assessment tax, if any is left over",
        tier: 2,
      },
      {
        href: "/filing/everify",
        label: "e-Verify",
        description: "The step that makes a submitted return count",
        tier: 1,
      },
    ],
  },
  {
    title: "After filing",
    items: [
      {
        href: "/refund",
        label: "Refund tracker",
        short: "Refund",
        description: "Where your money is, in plain language",
        tier: 1,
      },
      {
        href: "/history",
        label: "Filing history",
        short: "History",
        description: "Every return you have filed here",
        tier: 1,
      },
      {
        href: "/notices",
        label: "Notices",
        description: "What the department has sent you, and how to reply",
        tier: 2,
      },
      {
        href: "/grievance",
        label: "Something is wrong",
        short: "Grievance",
        description: "One place to raise and track any complaint",
        tier: 2,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/profile",
        label: "Profile",
        description: "Your details, bank account and PAN-Aadhaar status",
        tier: 1,
      },
      {
        href: "/help",
        label: "Help & jargon",
        short: "Help",
        description: "Plain-language explanations of every term here",
        tier: 2,
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** The five that get a permanent slot on a phone. */
export const bottomNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/income", label: "Income", icon: "wallet" },
  { href: "/reconciliation", label: "Reconcile", icon: "compare" },
  { href: "/filing", label: "File", icon: "file" },
] as const;
