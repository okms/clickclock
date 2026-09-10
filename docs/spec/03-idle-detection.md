# IDLE: Idle and absence detection

The product keeps today's total honest by noticing when the user is away.

## Requirements

### IDLE-01 Idle threshold — Baseline
The product must have an idle threshold. The baseline value is **5 minutes**. Idle time is
measured from the last keyboard or pointer input on the computer, regardless of which
application had focus.

### IDLE-02 Automatic pause — Baseline
While Running, when the user's idle time reaches the threshold, the product must pause
automatically.

### IDLE-03 The idle period is not counted — Baseline
When an automatic pause happens, the time from the last input until the pause must be
removed from today's total. The user should end up with the total they had at the moment
they stopped working. The removal never takes the total below what it was when the
current Running period began.

*Acceptance notes.* Threshold 5 min; total reads `1.00` and the user walks away. After 5
minutes the product pauses and the total reads `1.00`, not `1.08`.

### IDLE-04 The pause is explained — Baseline
The product must make it visible that the pause was automatic and how long the user had
been idle (in whole minutes) when it happened.

### IDLE-05 Automatic resume after automatic pause — Baseline
When the product is Paused because of `IDLE-02` and new keyboard or pointer input is
detected, it must resume Running by itself and indicate that it resumed after idle.

### IDLE-06 Manual pause never auto-resumes — Baseline
A pause requested by the user (`TT-02`) must never be resumed by activity detection.
Only automatic pauses auto-resume.

### IDLE-07 Automatic resume is optional — Accepted
The user should be able to turn automatic resume (`IDLE-05`) off, so that returning to the
computer for something unrelated to work does not start the timer.

### IDLE-08 Configurable threshold — Accepted
The user should be able to change the idle threshold within a sensible range (for example
1 to 30 minutes). See `SET-01`.

### IDLE-09 Idle handling is visible in the main view — Baseline
The main view must state the current idle threshold so the user knows what to expect.
