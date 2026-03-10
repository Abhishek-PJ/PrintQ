import { PrintRule } from "../types";
import { IShopPricing } from "../models/Shop";

export interface BreakdownItem {
  label: string;
  amount: number;
}

export function calculatePrice(
  rules: PrintRule[],
  copies: number,
  pricing: IShopPricing
): { breakdown: BreakdownItem[]; total: number } {
  const breakdown: BreakdownItem[] = [];
  let subtotal = 0;

  for (const rule of rules) {
    const pages = rule.toPage - rule.fromPage + 1;
    if (pages <= 0) continue;

    const ratePerPage =
      rule.colorMode === "bw"
        ? rule.sided === "single" ? pricing.bwSingle : pricing.bwDouble
        : rule.sided === "single" ? pricing.colorSingle : pricing.colorDouble;

    const amount = pages * ratePerPage;
    subtotal += amount;

    const colorLabel = rule.colorMode === "bw" ? "B&W" : "Color";
    const sideLabel = rule.sided === "single" ? "Single Sided" : "Double Sided";
    breakdown.push({
      label: `Pages ${rule.fromPage}-${rule.toPage} (${pages} pages, ${colorLabel}, ${sideLabel})`,
      amount
    });
  }

  if (copies > 1) {
    breakdown.push({ label: `Subtotal x ${copies} copies`, amount: subtotal * copies });
  }

  const total = subtotal * copies;
  return { breakdown, total };
}
