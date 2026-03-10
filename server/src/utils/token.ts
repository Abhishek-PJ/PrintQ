import { IOrder } from "../models/Order";

export const nextToken = async (): Promise<string> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Get all tokens issued today to check for collisions
  const todayOrders = await IOrder.find({ createdAt: { $gte: startOfDay, $lt: endOfDay } })
    .select("token");

  const usedTokens = new Set(todayOrders.map((o) => o.token));

  // Determine which letter is in use today (use first order's letter, or start with A)
  const LETTERS = ["A","B","C","D","E","F","G","H","I","J"];
  let letter = "A";
  if (todayOrders.length > 0) {
    letter = todayOrders[0].token.charAt(0);
    // Fallback to A if somehow an out-of-range letter snuck in
    if (!LETTERS.includes(letter)) letter = "A";
  }

  // Try to find an unused random number for the current letter
  for (let attempt = 0; attempt < 999; attempt++) {
    const num = Math.floor(Math.random() * 999) + 1; // 1–999
    const candidate = `${letter}${String(num).padStart(3, "0")}`;
    if (!usedTokens.has(candidate)) {
      return candidate;
    }
  }

  // All 999 slots for this letter exhausted — advance to next letter
  const nextIndex = (LETTERS.indexOf(letter) + 1) % LETTERS.length;
  const fallbackLetter = LETTERS[nextIndex];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${fallbackLetter}${String(num).padStart(3, "0")}`;
};
