import { describe, expect, it } from "vitest";
import { currency, expectedRevenue, formatDate, wonRevenueByMonth } from "./format";
import type { Deal } from "../../api/client";

const deal = (overrides: Partial<Deal>): Deal => ({
  id: "deal-1", name: "Example", organization_id: "org-1", organization_name: "Example Co",
  main_contact_id: null, main_contact_name: null, stage: "Won", value_usd: 1000, probability: 100,
  probability_source: "derived", expected_close_date: null, actual_close_date: "2026-03-15", late: false,
  ...overrides,
});

describe("dashboard formatting and calculations", () => {
  it("calculates weighted revenue and excludes nothing from the supplied deal set", () => {
    expect(expectedRevenue([
      deal({ value_usd: 1000, probability: 25 }),
      deal({ value_usd: 200, probability: 50 }),
    ])).toBe(350);
  });

  it("builds exactly twelve month buckets and sums won deals into their close month", () => {
    const result = wonRevenueByMonth([
      deal({ value_usd: 800, actual_close_date: "2026-03-05" }),
      deal({ value_usd: 200, actual_close_date: "2026-03-19" }),
      deal({ value_usd: 400, stage: "Lost", actual_close_date: "2026-03-21" }),
      deal({ value_usd: 900, actual_close_date: "2025-02-01" }),
    ], new Date(2026, 2, 20));
    expect(result).toHaveLength(12);
    expect(result[11]).toEqual({ month: "Mar", revenue: 1000 });
    expect(result[0].revenue).toBe(0);
  });

  it("formats money with a currency and parses date-only values without timezone shifts", () => {
    expect(currency(1250)).toBe("$1,250");
    expect(formatDate("2026-02-03")).toBe("Feb 3, 2026");
    expect(formatDate(null)).toBe("Not set");
  });
});
