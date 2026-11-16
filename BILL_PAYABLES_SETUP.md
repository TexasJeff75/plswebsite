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
