import { addDays, differenceInCalendarDays, format, isFriday, nextFriday, parseISO, previousFriday } from 'date-fns';

const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => c / 100;
export const iso = (d) => format(d, 'yyyy-MM-dd');

// The Friday on or after the given date.
export function fridayOnOrAfter(date) {
  return isFriday(date) ? date : nextFriday(date);
}

// The Friday on or before the given date.
export function fridayOnOrBefore(date) {
  return isFriday(date) ? date : previousFriday(date);
}

// Weekly installments starting on startDate. Give either weeks (split evenly)
// or perWeek (a fixed amount). The last payment absorbs any rounding.
export function weeklyInstallments(total, startDate, { weeks, perWeek }) {
  const totalCents = toCents(total);
  if (!(totalCents > 0) || !startDate) return [];
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;

  let amounts = [];
  if (weeks) {
    const n = Math.max(1, Math.floor(weeks));
    const base = Math.floor(totalCents / n);
    amounts = Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCents - base * (n - 1) : base));
  } else if (perWeek) {
    const per = toCents(perWeek);
    if (!(per > 0)) return [];
    const n = Math.ceil(totalCents / per);
    if (n > 520) return [];
    amounts = Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCents - per * (n - 1) : per));
  }
  return amounts
    .filter((c) => c > 0)
    .map((c, i) => ({ planned_date: iso(addDays(start, 7 * i)), amount: fromCents(c) }));
}

export function sumAmounts(rows) {
  return fromCents(rows.reduce((s, r) => s + toCents(r.amount || 0), 0));
}

export function daysLate(plannedDate, dueDate) {
  if (!plannedDate || !dueDate) return 0;
  return differenceInCalendarDays(parseISO(plannedDate), parseISO(dueDate));
}
