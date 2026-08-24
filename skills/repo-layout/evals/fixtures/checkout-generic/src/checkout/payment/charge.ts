/** Domain policy only — amount and currency. No payment-provider coupling. */
export function charge(amount: number, currency: string) {
  return { amount, currency };
}
