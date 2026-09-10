# NF: Non-functional requirements

### NF-01 Local only — Baseline
The product must work with no network connection, must never require an account, and must
never send any data off the computer. There is no telemetry, update check, or sync.

### NF-02 Lightweight — Baseline
The product must be quick to launch (main view visible within two seconds on ordinary
hardware) and unobtrusive while running all day: it should not be noticeable in CPU usage
while idle or Running.

### NF-03 No installation ceremony — Baseline
The product should run from a single application bundle or executable without requiring
the user to install runtimes or dependencies separately.

### NF-04 Single user — Baseline
The product is for one person on their own computer. There is no sharing, no
collaboration, and no multi-user data model.

### NF-05 Runs on the user's desktop platforms — Proposed
The product should run on macOS and Windows. Linux support may follow if it costs little.

### NF-06 Accessible — Proposed
All controls should be reachable by keyboard with visible focus, text and controls should
meet common contrast guidance, and motion should respect the user's reduced-motion
preference.

### NF-07 Sensible footprint — Proposed
Installed size under roughly 30 MB and resident memory under roughly 100 MB are the
targets. These are targets, not hard limits; local-only and feasibility win over size.

### NF-08 Free and open — Baseline
The product is released under a permissive open-source licence.
