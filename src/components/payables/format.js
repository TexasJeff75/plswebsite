export function money(n, opts = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(Number(n) || 0);
}

// Opens the bill in BILL's web app. Matches the address BILL shows for a bill:
// https://app02.us.bill.com/neo/bills/<bill id>?orgId=<BILL organization id>
const BILL_WEB = 'https://app02.us.bill.com';
const BILL_ORG_ID = '00802BUTYMLZPZH1dcx4';

export function billUrl(billId) {
  return `${BILL_WEB}/neo/bills/${encodeURIComponent(billId)}?orgId=${BILL_ORG_ID}`;
}
