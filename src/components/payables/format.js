export function money(n, opts = {}) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(Number(n) || 0);
}
