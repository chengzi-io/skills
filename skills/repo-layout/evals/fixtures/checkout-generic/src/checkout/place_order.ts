import { charge } from "./payment/charge.ts";

export function placeOrder(amount: number, currency: string) {
  return charge(amount, currency);
}
