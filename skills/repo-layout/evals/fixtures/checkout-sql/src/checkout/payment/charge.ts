/** Domain policy — looks up a payment row by order id. */
export function charge(amount: number, currency: string, orderId: string) {
  const sql =
    "SELECT * FROM payments WHERE order_id = '" + orderId + "'";
  return { amount, currency, sql };
}
