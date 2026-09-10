# TT: Time tracking

The core of the product: one running total per day, controlled by a start/pause action and
a stop action.

## State model

```
              start                 pause
  Stopped ───────────▶ Running ◀───────────▶ Paused
     ▲                    │                    │
     └────── stop ────────┴────── stop ────────┘
```

- `start` is available in Stopped and Paused.
- `pause` is available in Running.
- `stop` is available in Running and Paused. In Stopped it does nothing.

## Requirements

### TT-01 Start begins counting — Baseline
The user must be able to start tracking. From that moment, elapsed wall-clock time is added
to today's total until tracking is paused or stopped.

### TT-02 Pause keeps the total — Baseline
The user must be able to pause tracking. Pausing stops counting and keeps today's total
intact. Starting again continues adding to the same total.

### TT-03 One control for start and pause — Baseline
Start and pause must be offered as a single control whose meaning follows the current
state: it starts when Stopped or Paused, and pauses when Running. The control must make
its current meaning obvious (label and appearance) at all times.

### TT-04 Stop clears the day — Baseline
The user must be able to stop tracking. Stopping ends counting **and resets today's total
to zero**. Stop is unavailable when there is nothing to clear (Stopped with a zero total).

*Rationale.* In the original product "stop" doubles as "clear today". It is the only
destructive action in the product.

### TT-05 Stop asks or offers a way back — Proposed
Because stop discards work time, the product should either confirm before clearing or offer
a short window to undo the clearing. A single accidental click must not silently destroy a
day's total.

### TT-06 Any number of sessions per day — Baseline
The user may start and pause any number of times during a day. Today's total is the sum of
all counted periods since the day began or since the last stop, whichever is later.

### TT-07 Counting is accurate — Baseline
Today's total must be accurate to within one second per hour of Running time under normal
operation. Rounding for display is covered in `DISP`.

### TT-08 Always paused after launch — Baseline
When the product is launched (by the user or automatically with the computer) it must not
be Running. If a total exists for today it launches Paused with that total; otherwise it
launches Stopped.

*Rationale.* Counting time nobody asked for is worse than forgetting to press start.

### TT-09 Counting survives being hidden — Baseline
Tracking must continue while the product's main view is hidden, minimised, or behind other
applications. Only the user's pause/stop actions and absence detection (`IDLE`) stop the
count.

### TT-10 The day rolls over at midnight — Baseline
When the local date changes, today's total is finalised under the old date and counting
continues under the new date without the user doing anything. Whatever state the product
was in (Running or Paused) carries over unchanged.

### TT-11 Suspended time is not worked time — Baseline
If the computer was asleep, hibernated, or otherwise not running the product for a period
longer than the idle threshold while Running, that period must not be added to today's
total. The product must behave as if an automatic pause (`IDLE-02`) had happened at the
start of the gap.

*Acceptance notes.* Close the lid for 20 minutes while Running; on wake, today's total has
grown by at most the idle threshold, and the product reports it paused automatically.

### TT-12 Manual adjustment of today's total — Proposed
The user should be able to add or subtract time from today's total in steps (for example
15 minutes) to correct for forgetting to start or pause. Adjustments are part of today's
total and are persisted like counted time. The total may not go below zero.

### TT-13 Keyboard control — Proposed
The main view should let the user start/pause with the keyboard (for example the space bar)
without needing the pointer.
