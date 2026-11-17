"""Builds the Bank tab snapshot for the operating account (****5761).

Usage: python3 -I scripts/bank_snapshot_build.py raw.json out.json

raw.json holds BankBridge answers for account ****5761:
  as_of: "YYYY-MM-DD"
  accounts:   list_accounts answer
  months:     list of get_monthly_cashflow answers (last 6 months, any order)
  weekly:     get_spending_summary group_by=week, start_date about 16 weeks back
  categories: get_spending_summary group_by=category (last 30 days)
  payees:     get_spending_summary group_by=merchant, limit=100 (last 30 days)
  recurring:  get_recurring_charges answer
  deposits:   [{date, amount}] every POSTED money-in transaction on ****5761 (list_transactions
              category TRANSFER_IN and INCOME) from the first weekly week on; amount positive
out.json is the body to POST to the cash-import function ({"bank_snapshot": {...}}).
"""
import json, re, sys, datetime
raw = json.load(open(sys.argv[1]))
CAT = {'TRANSFER_OUT':'Transfers out (BILL, payroll)','LOAN_PAYMENTS':'Loan and card payments','GOVERNMENT_AND_NON_PROFIT':'Payroll taxes and government',
 'GENERAL_SERVICES':'Services, fees and insurance','HOME_IMPROVEMENT':'Rent and facilities','GENERAL_MERCHANDISE':'Supplies and purchases',
 'MEDICAL':'Medical, lab and utilities','BANK_FEES':'Bank fees','FOOD_AND_DRINK':'Food and drink','ENTERTAINMENT':'Subscriptions','TRAVEL':'Travel',
 'TRANSPORTATION':'Transportation','RENT_AND_UTILITIES':'Rent and utilities','OTHER':'Other'}
def src(s):
    if re.match(r'^INTUIT \d+ DEPOSIT', s, re.I): return 'QuickBooks deposit'
    if re.match(r'^PROXIMITY LAB', s, re.I): return 'Proximity Lab Services'
    m = re.search(r'TRANSFER FROM X(\d+)', s, re.I)
    if m: return 'Transfer from ****' + m.group(1)
    if re.match(r'^REMOTE \d+ DEPOSIT', s, re.I): return 'Check deposit'
    if re.search(r'WIRE TRANSFER CREDIT', s, re.I): return 'Wire received'
    return s
def payee(s):
    rules = [(r'^BILL\.COM PAYABLES','BILL.com vendor payments'),(r'^BILL\.COM LLC BILLING','BILL.com fees'),(r'^TELGE WAREHOUSES','Telge Warehouses (rent)'),
             (r'^INTUIT FINANCING','QuickBooks loan'),(r'^CAPITAL ONE','Capital One card'),(r'^SSBTRUSTOPS','401(k) contributions'),
             (r'^INTUIT \d+ TRAN FEE','QuickBooks payment fees'),(r'^HEALTH CARE SERV','Health Care Service (BCBSTX)'),(r'^TRUSTMARK','TrustMark loan'),(r'^HARTFORD FIRE','Hartford (insurance)')]
    for pat, name in rules:
        if re.match(pat, s, re.I): return name
    return s
def monday(wk):
    y, w = int(wk[:4]), int(wk[6:])
    jan4 = datetime.date(y,1,4)
    return (jan4 - datetime.timedelta(days=jan4.weekday()) + datetime.timedelta(weeks=w-1)).isoformat()
months = []
for m in sorted(raw['months'], key=lambda x: x['month'], reverse=True):
    months.append({'month': m['month'], 'income': m['income'], 'expenses': m['expenses'], 'net': m['net'], 'partial': bool(m.get('partial_month')),
      'top_in': [{'name': src(r['source']), 'amount': r['amount']} for r in m['top_income_sources']],
      'top_out': [{'name': CAT.get(r['category'], r['category']), 'amount': r['amount']} for r in m['top_expense_categories']]})
wk = {monday(g['group']): {'week_start': monday(g['group']), 'total': g['total'], 'count': g['transaction_count'], 'deposits': 0} for g in raw['weekly']['groups']}
first = min(wk) if wk else None
for t in raw.get('deposits', []):
    dt = datetime.date.fromisoformat(t['date']); mon = (dt - datetime.timedelta(days=dt.weekday())).isoformat()
    if first and mon < first: continue
    w = wk.setdefault(mon, {'week_start': mon, 'total': 0, 'count': 0, 'deposits': 0}); w['deposits'] += abs(float(t['amount']))
weekly = sorted(({**w, 'deposits': round(w['deposits'], 2)} for w in wk.values()), key=lambda x: x['week_start'])
cats = [{'category': CAT.get(g['group'], g['group']), 'total': g['total'], 'count': g['transaction_count']} for g in raw['categories']['groups']]
by = {}
for g in raw['payees']['groups']:
    k = payee(g['group']); r = by.setdefault(k, {'payee': k, 'total': 0, 'count': 0}); r['total'] += g['total']; r['count'] += g['transaction_count']
payees = sorted(({**r, 'total': round(r['total'], 2)} for r in by.values()), key=lambda r: -r['total'])[:10]
rec = sorted([{'merchant': r['merchant'], 'frequency': r['frequency'], 'amount': r['amount'], 'last_charge': r['last_charge']} for r in raw['recurring']['recurring']], key=lambda r: -r['amount'])
acct = next(a for a in raw['accounts']['accounts'] if a['mask'] == '5761')
snap = {'bank_snapshot': {'account_last4': '5761', 'data': {'as_of': raw['as_of'], 'balance': acct['current_balance'], 'available': acct['available_balance'],
        'months': months, 'weekly': weekly, 'categories_30d': cats, 'payees_30d': payees, 'recurring': rec}}, 'source': raw.get('source', 'daily bank update')}
json.dump(snap, open(sys.argv[2], 'w'))
print('months', [m['month'] for m in months], 'weeks', len(weekly), 'payees', [p['payee'] for p in payees][:5], 'bytes', len(json.dumps(snap)))
