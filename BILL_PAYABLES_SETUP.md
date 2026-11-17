# BILL Payables Monitor: Phase 1 setup

Phase 1 adds a **Payables** page (Super Admin only) with the Spend dashboard. Data is copied from BILL by the `bill-sync` edge function. The connection is **read-only**: it never creates, changes or pays anything in BILL.

## 1. Create the read-only BILL developer app (sandbox first)

1. Sign in to the BILL **sandbox** web app (https://login.stage.us.bill.com/neo/login). Create a sandbox account first if you do not have one.
2. Create a developer app and choose the access scope **Accounting data access**. This scope cannot create payments or change bank accounts.
3. Copy the **client ID** and **client secret**. The secret is shown once; store it somewhere safe.

When Phase 1 is approved in the sandbox, repeat these steps in the production BILL app (https://login.us.bill.com/neo/login).

## 2. Apply the database migration

Run `supabase/migrations/20261116170000_create_bill_payables_monitor.sql` in the Supabase SQL Editor for this project. It only adds new `ap_*` tables and functions; it does not change existing tables.

## 3. Deploy the edge function and add its secrets

Deploy `supabase/functions/bill-sync` (Supabase CLI: `supabase functions deploy bill-sync`, or through Bolt).

In Supabase, open **Edge Functions → Secrets** and add:

| Secret | Value |
|---|---|
| `BILL_ENV` | `sandbox` (change to `production` later) |
| `BILL_CLIENT_ID` | client ID from step 1 |
| `BILL_CLIENT_SECRET` | client secret from step 1 |
| `BILL_SYNC_CRON_SECRET` | any long random string, used only by the nightly schedule |

## 4. Run the first sync

Open **Payables** in the Deployment Tracker and click **Sync now**. The first sync copies everything and may take a few rounds; the page keeps going until it is done.

## 5. Schedule the nightly sync

In the SQL Editor, enable the `pg_cron` and `pg_net` extensions (Database → Extensions), then run this with your values filled in. It runs every night at 2:13 AM Central (08:13 UTC).

```sql
select cron.schedule(
  'bill-sync-nightly',
  '13 8 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/bill-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR-ANON-KEY',
      'x-cron-secret', 'YOUR-BILL_SYNC_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Switching to production (Phase 3)

Before you start, run `supabase/migrations/20261116210000_ap_data_source_guard.sql` in the SQL Editor and redeploy `bill-sync` with the latest code. Together they stop sandbox and production data from ever mixing.

1. **Create the production developer app.** Sign in to the production BILL web app (https://login.us.bill.com/neo/login) as an admin and create a developer app with **Accounting data access**. Copy the client ID and client secret.
2. **Swap the secrets.** In Supabase, Edge Functions → Secrets, set `BILL_ENV` to `production` and replace `BILL_CLIENT_ID` and `BILL_CLIENT_SECRET` with the production values.
3. **Sync once.** On the Payables page click **Sync now**. It stops with "Data source mismatch" because the saved data is from the sandbox. This is expected.
4. **Clear the sandbox data.** Click **Clear BILL data**, then confirm. This removes the copied sandbox data and every pay plan (they belong to sandbox bills). Cash cushion settings are kept.
5. **Run the first production sync.** Click **Sync now** again. A large account can take several rounds; the page keeps going until it is done. The header badge now reads **Production data**.
6. **Check the numbers against BILL** (see below).
7. **Schedule the nightly sync** (step 5 above) if you have not already.

If you prefer SQL to the button, step 4 is: `select ap_clear_bill_data();` run while signed in as a Super Admin, or truncate the tables listed in that function.

### Checking the numbers against BILL

Compare these after the first production sync. Small differences usually mean BILL changed something after the sync; click **Sync now** and compare again.

| Check | In the tracker | In BILL |
|---|---|---|
| Open AP total | Forecast tab, **Open AP** | Bills list, total of all unpaid bills (or the AP aging report) |
| Past due | Forecast tab, **Past due** | AP aging report, everything past due |
| One vendor's balance | Spend tab, click the vendor, **Open balance** | That vendor's page, open balance |
| Last month's bills | Spend tab, **This month** or a custom range, **Billed** basis | Bills list filtered to that month's bill dates |
| Scheduled payments | Forecast tab, the **Scheduled in BILL** part of each week | Payments list, scheduled payments |

Note: the tracker's open AP includes payments that are scheduled but not cleared yet, because that money has not left the bank. If BILL's report leaves scheduled payments out, subtract the Forecast's scheduled amounts before comparing.

## How the sync works

- Each run asks BILL only for records changed since the last run (by `updatedTime`, with a 5-minute overlap), 100 per page, one request at a time.
- A run stops starting new pages after about 100 seconds and reports that more is left; **Sync now** keeps going automatically, and the nightly job picks up the rest the next night.
- Archived records are fetched in a second pass so archived bills drop out of the reports.
- Tax IDs and bank account details are never copied.
- Every run is recorded in `ap_sync_runs` with its counts and any error.

## Phase 2: Pay Plan and Forecast

1. Run `supabase/migrations/20261116200000_create_ap_pay_plans_and_forecast.sql` in the SQL Editor. It only adds new tables and functions.
2. Redeploy `bill-sync` (or paste the updated single-file version) so each sync also matches BILL payments to Pay Plan installments. Until then, the Forecast and Pay Plan tabs run the matching themselves when they open.

How matching works: a BILL payment matches a planned installment when it is on the same bill, for the same amount (within $0.01), and its process date is within 3 days of the planned date. Matched installments show **Scheduled** with BILL's date, then **Paid** once BILL processes the payment. An installment with no match more than 3 days after its date shows **Missed**.

## Phase 4: Email alerts

1. Run `supabase/migrations/20261116220000_ap_alerts.sql` in the SQL Editor.
2. Redeploy `bill-sync` with the latest code (paste the single-file version).

After each completed sync (nightly or **Sync now**), every Super Admin gets one email listing new:

- **Payment problems:** failed, held, expiring or escheated payments updated in the last 14 days.
- **Missed installments:** Pay Plan payments not scheduled in BILL within 3 days of the planned date.
- **Bills waiting on approval for more than 7 days.**

Each alert is emailed once (a payment is alerted again if its status changes). No email is sent when there is nothing new. Alerts use the existing `RESEND_API_KEY` and `EMAIL_FROM` secrets; optionally set `TRACKER_URL` if the tracker moves off https://proximitylabservices.com. If an email fails, the sync still finishes and the alerts are retried on the next sync.

## Phase 5: Weekly release to BILL

Plans stay in the tracker until you release a week. **Release to BILL** on the Pay Plan tab creates that week's payments in BILL on their planned dates (or BILL's earliest date, if later). Nothing else in the plan is sent, so the plan stays easy to change when cash is tight.

### Setup

1. **Make sure a BILL developer app with Full access is available.** By default `bill-pay` uses the same `BILL_CLIENT_ID` and `BILL_CLIENT_SECRET` as the sync, so that app needs Full access (an Accounting data access app cannot create payments, and an app's access level cannot be changed after it is created). To keep the sync read-only instead, create a second app with Full access and set `BILL_PAY_CLIENT_ID` and `BILL_PAY_CLIENT_SECRET`; `bill-pay` uses those when present. BILL requires MFA with your phone for Full access. The app acts with the permissions of the BILL user who creates it: if that user's payments need approval in BILL, released payments wait in BILL's approvals until someone approves them.
2. Run `supabase/migrations/20261116230000_ap_payment_release.sql` in the SQL Editor.
3. Only if you created a separate Full access app: in Supabase, Edge Functions → Secrets, add `BILL_PAY_CLIENT_ID` and `BILL_PAY_CLIENT_SECRET`. `BILL_ENV` is shared with the sync.
4. Deploy the new `bill-pay` function (paste the single-file version, name it exactly `bill-pay`, keep Verify JWT on), and redeploy `bill-sync` (its BILL client gained a POST method used by bill-pay).

### Safeguards

- Super Admin only. The read-only sync app is unchanged; only `bill-pay` holds the Full access credentials.
- Before sending, each bill is re-read from BILL. A payment larger than what BILL shows left to schedule is not sent.
- BILL lists the bank accounts that can pay each vendor and the earliest date; unverified accounts cannot be chosen.
- A release over $25,000 needs a second confirmation.
- Every payment carries a unique BILL transaction number. If BILL does not answer, the tracker looks the number up before trying again, so a retry cannot pay twice.
- Every release and cancel is logged in `ap_payment_actions` with who, when, amount, BILL payment ID and BILL's answer.
- **Cancel in BILL** (the x next to a scheduled payment) works until BILL starts processing. After that, a payment can only be voided in BILL.

### First test

Release one small installment dated at least a few days out, confirm it appears in BILL (as scheduled, or waiting on approval), then cancel it from the tracker and confirm BILL shows it canceled.

## Cash Flow tab

A week-by-week cash grid (weeks start on Sunday), like a cash flow spreadsheet.

- **Vendor and people payments** come from BILL and the Pay Plan: paid (yellow), scheduled in BILL (teal), and planned but not yet in BILL (blue). Overdue planned payments count in the current week. Change them on the Pay Plan tab.
- **Other lines** (cash collected, payroll, rent, loans, credit card) are typed into the grid. Click a cell to change it. The repeat button fills the same amount every 1 to 4 weeks. Add, rename or delete lines from the grid.
- **Balances.** Set the opening balance and the week it applies to. Each week then starts with last week's actual ending if one is entered, otherwise the forecast ending. Enter actual endings from the bank each week.
- **People vs vendors.** Hover a vendor row and click the people icon to move it between the People and Vendors groups.
- Open bills with no pay plan are shown on their own row and are not counted, so plan or hold them on the Pay Plan tab.

Migration: `20261117120000_ap_cash_flow.sql`.

### Automatic bank updates (cash-import function)

A daily task reads the bank account and sends that week's actuals to the `cash-import` function, which updates the Cash Flow tab:

- **Cash Collected:** all money into the BILL bank account for each finished week (Sunday to Saturday), including transfers in.
- **Payroll:** the Gusto net, tax and reimbursement charges, for any week where payroll has posted. Other weeks keep their forecast.
- **Actual ending:** the bank balance at the end of each finished week (Saturday).

The function can only write those two lines and the weekly actual ending, only for Sunday weeks, and only amounts up to 10,000,000. It needs its own key.

Setup:
1. Make a random key of at least 24 characters (for example from a password manager). Add it as the function secret `CASH_IMPORT_KEY`.
2. Create the function `cash-import` by pasting `supabase/functions/cash-import/index.ts`. Turn **Verify JWT off** for this function: the caller has no user session, and the key protects it instead.
3. Save the same key where the daily task can send it as the `x-cash-import-key` header. Never paste it into a chat or a file.

To stop automatic updates, delete the `CASH_IMPORT_KEY` secret or change it.
