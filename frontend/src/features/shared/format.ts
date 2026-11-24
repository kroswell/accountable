import type { Deal } from "../../api/client";

export const STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
export const OPEN_STAGES = STAGES.slice(0, 4);

export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export function wonRevenueByMonth(deals: Deal[], now = new Date()): { month: string; revenue: number }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
      revenue: deals.filter((deal) => deal.stage === "Won" && deal.actual_close_date?.slice(0, 7) === key)
        .reduce((sum, deal) => sum + deal.value_usd, 0),
    };
  });
}

export function expectedRevenue(deals: Pick<Deal, "value_usd" | "probability">[]): number {
  return deals.reduce((total, deal) => total + deal.value_usd * deal.probability / 100, 0);
}
