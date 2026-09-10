# UI design

The visual reference is `../../design/prototype.html` (open it in a browser; it renders the
light and dark variants side by side and lets you switch states). This document is the
written contract the app must match. Behaviour comes from `../spec/`; this document decides
how it looks and what it says.

---

## 1. Idea

A consultant glances at this fifty times a day. It should read like **one line in a
ledger**: today's hours, set large, left-aligned, in a single quiet typeface, with the
tracking state stated in words next to a small coloured dot. Nothing else competes with the
number.

One bold element: the decimal-hours figure. Everything around it is disciplined and small.

Rejected on purpose: cards and panels, a progress ring, traffic-light buttons, all-caps
labels, decorative gradients, a monospace face for data. The baseline's green/yellow/red
buttons are replaced by colour on the state indicator only; the buttons themselves are
ink-on-paper.

---

## 2. Tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F2F3F0` | `#151A1D` | window background |
| `--ink` | `#171B1E` | `#E8ECEA` | primary text, primary button fill |
| `--ink-2` | `#6A7278` | `#8C959B` | secondary text, `HH:MM`, notes |
| `--line` | `#D6DAD5` | `#2B3236` | hairlines, outlined button border |
| `--raise` | `#FFFFFF` | `#1D2428` | hover surface for quiet controls |
| `--working` | `#1E7A55` | `#4CBE8A` | Running dot and word |
| `--away` | `#A8731A` | `#D9A441` | Paused dot and word |
| `--clear` | `#9E3B32` | `#D96C60` | destructive confirm only |
| `--focus` | `#2F6FE4` | `#6EA0FF` | keyboard focus ring |

Stopped uses `--ink-2` for dot and word. Appearance follows the system (`SET-04`).

### Type

One family: **Schibsted Grotesk** (SIL OFL, variable 400–900), **bundled with the app** as
`app/fonts/*.woff2`; the product never fetches fonts or anything else over the network
(`NF-01`). Fallback
`system-ui, -apple-system, "Segoe UI", sans-serif`. Tabular numerals everywhere numbers
tick (`font-variant-numeric: tabular-nums`). Weights used: 400 and 600 only.

| Role | Size / line | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hours figure | 104 px / 1 | 600 | −0.035em | `7.50`; the unit `hours` is a separate 15 px element so copying the figure yields `7.50` alone (`DISP-05`) |
| `HH:MM` | 26 px / 1.2 | 400 | −0.01em | colour `--ink-2` |
| State word | 15 px / 1.4 | 600 | 0 | colour follows state |
| Body, buttons | 15 px / 1.4 | 400 / 600 | 0 | |
| Date, notes, meta | 13 px / 1.5 | 400 | 0 | colour `--ink-2` |
| Section title (History, Settings) | 22 px / 1.2 | 600 | −0.01em | |

Sentence case everywhere. No all-caps.

### Space and shape

- Base unit 4 px. Window inset 28 px. Vertical rhythm 12 / 20 / 32 px.
- Radii: buttons 10 px, toggles 999 px, nothing else rounded.
- Hairlines are 1 px `--line`. No shadows.
- Window: 380 × 520 initial; minimum 320 × 440; contents anchor top-left and the figure
  scales down with `clamp()` below 360 px width.

---

## 3. Main view

```
┌──────────────────────────────────────┐
│ ● Running                      ▤  ⚙ │  state row; icon buttons: history, settings
│                                      │
│ Thursday 10 September               │  13 px, --ink-2
│                                      │
│ 7.50 hours                           │  104 px figure, 15 px unit at baseline
│ 07:30                                │  26 px, --ink-2
│                                      │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │              Pause               │ │  primary; outlined when Running, filled otherwise
│ └──────────────────────────────────┘ │
│  Clear today                         │  quiet text button; disabled when nothing to clear
│                                      │
│ Pauses by itself after 5 minutes     │  13 px note; states the threshold (IDLE-09)
│ away. Everything stays on this       │  and locality (PERS-03)
│ computer.                            │
└──────────────────────────────────────┘
```

Alignment: everything left-aligned to the 28 px inset, including the primary button's
label being centred *within* the button. The figure and the button are the only full-width
elements.

### The primary control (`TT-03`)

| State | Label | Style | Meaning |
|---|---|---|---|
| Stopped | **Start** | filled `--ink`, paper text | begin the day |
| Paused | **Start** | filled `--ink` | resume |
| Running | **Pause** | outlined `--line`, ink text | pausing is a soft action; the resting look while working is calm |

Space bar and Enter activate it when it has focus (`TT-13`, proposed). Hover raises the
outlined variant to `--raise`; the filled variant darkens 6 %.

### State row (`DISP-06`)

| State | Dot | Word | Second line (`--ink-2`, 13 px) |
|---|---|---|---|
| Running | `--working`, gentle 2 s pulse (off under reduced motion) | Running | none, or "Resumed after being away" for 10 s after auto-resume |
| Paused (manual) | `--away`, static | Paused | none |
| Paused (automatic) | `--away`, static | Paused | "Away for 12 minutes, paused by itself" |
| Stopped | `--ink-2`, static | Stopped | none |

### Clear today (`TT-04`, `TT-05`)

Quiet text button under the primary control. Disabled (`--ink-2` at 50 %) when Stopped
with a zero total. On activation the action area swaps in place to a confirmation:

```
Clear today's 7.50 hours?
[ Clear ]  Keep
```

`Clear` is filled `--clear`; `Keep` is the quiet style. Escape or `Keep` returns without
change. After clearing, the figure reads `0.00`, the state is Stopped, and the note line
briefly reads "Today cleared".

### Copy (`DISP-05`, `DISP-08`)

The figure and `HH:MM` are selectable text. Clicking the figure copies `7.50` and shows a
2 s inline "Copied" beside the unit.

---

## 4. History view (`HIST`, proposed)

Reached from the list icon. The state row is replaced by a back control labelled "Today".

```
Today                                      
                                           
Previous days                              
                                           
This week            31.25    31:15        
Tue 9 Sep             8.25    08:15        
Mon 8 Sep             7.50    07:30        
                                           
Week 36              38.00    38:00        
Fri 5 Sep             7.75    07:45        
…                                          
```

Rows are 40 px, hairline-separated, figures tabular and right-aligned in two columns.
Week rows are 600 weight. Clicking a decimal figure copies it. Empty state: "Nothing yet.
Previous days appear here once you have worked a full day."

---

## 5. Settings view (`SET`)

Reached from the sliders icon. Back control "Today".

```
Settings

Pause after being away for       [ 5 minutes  ▾ ]
Resume when I come back                     [ on ]
Show time in the menu bar                   [ on ]
Open at login                               [ on ]

Your data is one plain file on this computer.
Nothing is sent anywhere.
```

Threshold options: 1, 2, 3, 5, 10, 15, 20, 30 minutes. Toggles are 44 × 24 switches with
the knob in `--paper` and track in `--ink` when on, `--line` when off. If launch-at-login
cannot be changed the toggle snaps back and a 13 px line under it says "Your computer did
not allow this change." (`AUTO-04`).

---

## 6. Tray (`TRAY`)

The tray item is a single rendered image, 22 pt tall (44 px at 2x), in the platform's
template style (black shapes with alpha; macOS recolours it for light and dark menu bars).

- **Time mode** (default, `TRAY-09`): today's decimal hours, `7.50`, set in Schibsted
  Grotesk at 14 pt, vertically centred, 2 pt side padding; width follows the text.
- **Icon mode** (`TRAY-10` off): the clock glyph, a stroked circle with a minute hand at
  twelve and an hour hand at two, in a 22 pt square.
- **State glyph** (`TRAY-11`): Paused adds two rounded vertical bars (11 pt tall), Stopped a
  rounded square (9 pt), black at 50 % opacity. In time mode the glyph sits 3 pt to the
  right of the digits; in icon mode it is overlaid on the right side of the clock. Running
  adds nothing.
- **Interaction**: left click toggles Start/Pause (`TRAY-08`). Right click opens the menu:
  Start, Pause, Stop / Clear today, Show, Quit, with inapplicable items disabled
  (`TRAY-03`). Tooltip: `Running, 7.50 hours (07:30)` (`TRAY-02`).
- **Windows**: fixed 16 px tray squares cannot show text, so icon mode is always used
  there, with the overlay, and the tooltip carries the time.

---

## 7. Motion and accessibility

- Motion is limited to: the Running dot's pulse, a 120 ms cross-fade when the primary
  label changes, and the confirmation swap. All disabled under `prefers-reduced-motion`.
- Every control is a real `<button>`, `<select>`, or `role="switch"` with a visible 2 px
  `--focus` ring offset 2 px. Tab order: primary, clear, history, settings.
- Contrast: all text pairs meet 4.5:1 in both themes; the disabled clear button is exempt
  as inactive.
- The figure has `aria-live="off"`; the state word has `aria-live="polite"` so screen
  readers hear state changes but not every second.

---

## 8. Copy guide

Plain verbs, sentence case, no filler.

| Where | Text |
|---|---|
| Primary | Start / Pause |
| Destructive | Clear today / Clear / Keep |
| Auto-pause reason | Away for N minutes, paused by itself |
| Auto-resume notice | Resumed after being away |
| Note | Pauses by itself after N minutes away. Everything stays on this computer. |
| After clear | Today cleared |
| Copy feedback | Copied |
| Empty history | Nothing yet. Previous days appear here once you have worked a full day. |
| Autostart failure | Your computer did not allow this change. |
| First hide to tray (`TRAY-06`) | Still running in the menu bar. Quit from there when you are done. |
