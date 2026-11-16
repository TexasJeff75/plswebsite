export function money(n, opts = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(Number(n) || 0);
}

// Opens the bill in BILL's web app (BILL redirects to the signed-in user's org).
export function billUrl(billId) {
  return `https://app.bill.com/bill?id=${encodeURIComponent(billId)}`;
}
