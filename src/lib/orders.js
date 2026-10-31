/**
 * Pays an order from the wallet on the server (/api/orders/wallet-pay).
 * Prices and the wallet balance are checked there, and JoyTel products are ordered from JoyTel.
 * @param {string} memberId
 * @param {{product_id: string, qty: number, delivery?: string}[]} items
 * @param {string} delivery  default delivery detail (mobile number or address)
 * @returns {Promise<{transactions: object[], orders: {orderTid, productName, ok, refunded, error, needsCheck}[]}>}
 */
export async function payFromWallet(memberId, items, delivery = "") {
  const res = await fetch("/api/orders/wallet-pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: memberId, items, delivery }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to place order");
  return data;
}

/** Tells the customer what happened with JoyTel; returns true when everything went through. */
export function summarizeOrders(orders = [], toast) {
  const failed = orders.filter(o => !o.ok);
  if (failed.length === 0) {
    toast.success(orders.length ? "Order placed! Check My Orders for the status." : "Order placed! Paid from wallet.");
    return true;
  }
  for (const o of failed) {
    if (o.refunded) toast.error(`${o.productName} could not be delivered by JoyTel. Your wallet was refunded.`);
    else toast.error(`${o.productName}: JoyTel did not confirm the order yet. Please contact the shop before ordering again.`);
  }
  return false;
}

/** Asks the server to check a JOY SIM recharge with JoyTel (there is no callback for these). */
export async function checkRecharge(memberId, orderTid) {
  const res = await fetch("/api/orders/wallet-pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "check-recharge", member_id: memberId, orderTid }),
  });
  return res.json().catch(() => ({}));
}
