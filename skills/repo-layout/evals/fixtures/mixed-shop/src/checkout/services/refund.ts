export function refund(orderId: string) {
  return { orderId, refunded: true };
}
