# PERS: Persistence

## Requirements

### PERS-01 Today survives restarts — Baseline
Today's total and tracking state must survive the product being closed, the user logging
out, and the computer restarting. Relaunching on the same day shows the same total
(subject to `TT-08`: never Running).

### PERS-02 Previous days are kept — Baseline
When a new day begins, the previous day's total must remain stored. Data is never deleted
automatically.

### PERS-03 Data lives on this computer only — Baseline
All data must be stored locally on the user's computer under a per-user location. Nothing
is transmitted anywhere. See `NF-01`.

### PERS-04 Frequent, safe saving — Baseline
Progress must be saved often enough that an abrupt shutdown or crash loses at most one
minute of Running time. Saving must never leave the stored data in a corrupt or partially
written state; a failed save leaves the previous good data intact.

### PERS-05 Human-readable storage — Accepted
The stored data should be in a plain, human-readable text format that the user can open,
read, back up, and hand-edit with an ordinary text editor.

### PERS-06 Per-period detail is kept — Accepted
The product should store when each counted period started and ended, not only the daily
sum, so that history (`HIST`) and later corrections are possible. The daily total remains
derivable from the periods plus any manual adjustments (`TT-12`).

### PERS-07 Import from the original product — Deferred
The product may be able to import the daily totals of the original Consultant Timer's data
file so the user does not lose their history.
