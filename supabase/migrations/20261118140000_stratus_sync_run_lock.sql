/*
  # StratusDX sync: one run at a time

  The sync now hands a long catch-up to a background function that runs for
  up to 15 minutes, while the 5-minute schedule and the Run now button keep
  firing. run_lock_until lets only one run work at a time: a run takes the
  lock when it is empty or has expired, and clears it when done. If a run
  crashes, the lock simply expires.
*/

ALTER TABLE stratus_sync_checkpoint ADD COLUMN IF NOT EXISTS run_lock_until timestamptz;
