// Pricing helpers — UI-only.
// Stripe is still the source of truth for what we actually charge; these
// utilities exist so we can display a per-week breakdown next to every
// plan card without re-encoding the interval math at every callsite.

const WEEKS_PER_INTERVAL = {
  week: 1,
  month: 4.33,
  threemonth: 13,
  sixmonth: 26,
  year: 52,
} as const;

export type BillingInterval = keyof typeof WEEKS_PER_INTERVAL;

export function calculatePerWeek(
  totalAmountCents: number,
  interval: BillingInterval,
): string {
  const perWeek = totalAmountCents / 100 / WEEKS_PER_INTERVAL[interval];
  return `$${perWeek.toFixed(2)}`;
}

export function billingCaption(
  totalAmountCents: number,
  interval: BillingInterval,
): string {
  const total = `$${(totalAmountCents / 100).toFixed(2)}`;
  const intervalText: Record<BillingInterval, string> = {
    week: "every week",
    month: "every month",
    threemonth: "every 3 months",
    sixmonth: "every 6 months",
    year: "every year",
  };
  return `billed ${total} ${intervalText[interval]}`;
}
