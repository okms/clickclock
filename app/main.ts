/**
 * App boot and main event loop.
 * Timer-driven, 1 s interval tick; saves on transitions or every 30 s while running.
 * All user actions save immediately and repaint.
 */
import { createPlatform } from "./platform/index";
import { MockPlatform } from "./platform/mock";
import { Timer } from "../core/timer";
import { parseDoc, serializeDoc, withSettings, history } from "../core/store";
import { systemClock } from "../core/ports";
import { formatDecimalHours } from "../core/format";
import { viewModel } from "./view/model";
import { render } from "./view/render";
import type { UiState } from "./view/render";

(async () => {
  // Global state
  const platform = await createPlatform();
  const raw = await platform.loadDoc();
  let doc = parseDoc(raw);

  // First-run: set launch-at-login
  if (raw === null) {
    await platform.setLaunchAtLogin(true);
  }

  // Sync launch-at-login from OS
  doc = withSettings(doc, { launchAtLogin: await platform.getLaunchAtLogin() });

  const timer = new Timer(doc, systemClock);

  // UI state
  const ui: UiState = {
    view: "main",
    confirm: false,
    copied: false,
    loginHelp: "",
    history: [],
    settings: timer.settings,
  };

  let lastSave = Date.now();
  let noteOverride: string | null = null;
  let noteTimer: ReturnType<typeof setTimeout> | null = null;

  /** Show `text` in the note line for `ms`, then return to the default note. */
  function flashNote(text: string, ms: number): void {
    noteOverride = text;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      noteOverride = null;
      paint();
    }, ms);
    paint();
  }

  const root = document.querySelector(".app") as HTMLElement;

  // --- Main render function ---
  function paint(): void {
    const vm = viewModel(timer, Date.now(), { noteOverride });
    ui.history = history(timer.doc, timer.todayKey(), Date.now());
    ui.settings = timer.settings;
    render(root, vm, ui);
    void platform.setTray(vm.tray);
  }

  // --- Save function ---
  async function save(): Promise<void> {
    try {
      await platform.saveDoc(serializeDoc(timer.doc));
      lastSave = Date.now();
    } catch (err) {
      console.error("save failed", err);
    }
  }

  // --- User action handlers ---

  // Primary button (Start/Pause)
  root.querySelector('[data-slot="primary"]')?.addEventListener("click", () => {
    timer.toggle();
    ui.confirm = false;
    void save();
    paint();
  });

  // Clear button
  root.querySelector('[data-slot="clear"]')?.addEventListener("click", () => {
    ui.confirm = true;
    paint();
  });

  // Clear confirmation
  root.querySelector('[data-slot="confirm-yes"]')?.addEventListener("click", async () => {
    timer.stop();
    ui.confirm = false;
    await save();
    flashNote("Today cleared", 2500);
  });

  root.querySelector('[data-slot="confirm-no"]')?.addEventListener("click", () => {
    ui.confirm = false;
    paint();
  });

  // Escape cancels confirmation
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ui.confirm) {
      ui.confirm = false;
      paint();
    }
  });

  // Space/Enter toggles timer when focus is not in a form control
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (
      (e.key === " " || e.key === "Enter") &&
      (active === document.body || active === root)
    ) {
      e.preventDefault();
      timer.toggle();
      void save();
      paint();
    }
  });

  // Navigation buttons
  root.querySelector('[data-go="history"]')?.addEventListener("click", () => {
    ui.view = "history";
    ui.confirm = false;
    paint();
  });

  root.querySelector('[data-go="settings"]')?.addEventListener("click", () => {
    ui.view = "settings";
    ui.confirm = false;
    paint();
  });

  root.querySelector('[data-slot="back"]')?.addEventListener("click", () => {
    ui.view = "main";
    ui.confirm = false;
    paint();
  });

  // Copy hours figure
  root.querySelector('[data-slot="hours"]')?.addEventListener("click", async () => {
    await platform.copyText(formatDecimalHours(timer.todaySeconds()));
    ui.copied = true;
    paint();
    setTimeout(() => {
      ui.copied = false;
      paint();
    }, 2000);
  });

  // Copy history/list decimals
  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains("dec") &&
      target.classList.contains("num") &&
      target.textContent
    ) {
      await platform.copyText(target.textContent);
      ui.copied = true;
      paint();
      setTimeout(() => {
        ui.copied = false;
        paint();
      }, 2000);
    }
  });

  // Settings: threshold select
  root.querySelector('[data-slot="threshold"]')?.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    const text = select.options[select.selectedIndex]?.textContent;
    if (text) {
      const match = text.match(/(\d+)/);
      if (match && match[1]) {
        const minutes = parseInt(match[1], 10);
        timer.updateSettings({ idleThresholdMinutes: minutes });
        void save();
        paint();
      }
    }
  });

  // Settings: auto-resume toggle
  root.querySelector('[data-slot="autoresume"]')?.addEventListener("click", (e) => {
    const btn = e.target as HTMLButtonElement;
    const checked = btn.getAttribute("aria-checked") === "true";
    timer.updateSettings({ autoResume: !checked });
    void save();
    paint();
  });

  // Settings: launch-at-login toggle
  root.querySelector('[data-slot="login"]')?.addEventListener("click", async (e) => {
    const btn = e.target as HTMLButtonElement;
    const checked = btn.getAttribute("aria-checked") === "true";
    const next = !checked;
    const actual = await platform.setLaunchAtLogin(next);
    timer.updateSettings({ launchAtLogin: actual });
    ui.loginHelp = actual === next ? "" : "Your computer did not allow this change.";
    await save();
    paint();
  });

  // Settings: show-time-in-tray toggle
  root.querySelector('[data-slot="traytime"]')?.addEventListener("click", (e) => {
    const btn = e.target as HTMLButtonElement;
    const checked = btn.getAttribute("aria-checked") === "true";
    timer.updateSettings({ showTimeInTray: !checked });
    void save();
    paint();
  });

  // --- Tray actions ---
  platform.onTrayAction((action) => {
    switch (action) {
      case "start":
        if (timer.canStart) {
          timer.start();
          void save();
          paint();
        }
        break;
      case "pause":
        if (timer.canPause) {
          timer.pause();
          void save();
          paint();
        }
        break;
      case "stop":
        ui.confirm = true;
        ui.view = "main";
        paint();
        break;
      case "toggle":
        timer.toggle();
        void save();
        paint();
        break;
      case "show":
        // Not needed for web version
        break;
      case "quit":
        void platform.quit();
        break;
    }
  });

  // --- Window hidden (TRAY-06) ---
  platform.onWindowHidden(() => {
    if (localStorage.getItem("ct.hideNoticeShown") !== "1") {
      localStorage.setItem("ct.hideNoticeShown", "1");
      flashNote("Still running in the menu bar. Quit from there when you are done.", 6000);
    }
  });

  // --- Main loop ---
  setInterval(async () => {
    const idle = await platform.idleSeconds();
    const r = timer.tick(idle);

    if (
      r.transition ||
      (timer.state.kind === "running" && Date.now() - lastSave >= 30_000)
    ) {
      await save();
    }

    paint();
  }, 1000);

  // --- Dev controls (MockPlatform only) ---
  if (platform instanceof MockPlatform) {
    const mock = platform;
    const devbar = document.createElement("div");
    devbar.className = "devbar";

    const buttons = [
      { label: "Idle 0 s", fn: () => mock.simulateIdle(0) },
      { label: "Idle 5 min", fn: () => mock.simulateIdle(300) },
      { label: "Idle 10 min", fn: () => mock.simulateIdle(600) },
      { label: "Tray start", fn: () => mock.fireTray("start") },
      { label: "Tray pause", fn: () => mock.fireTray("pause") },
      { label: "Tray stop", fn: () => mock.fireTray("stop") },
      {
        label: "Window hidden",
        fn: () => mock.fireWindowHidden(),
      },
    ];

    for (const { label, fn } of buttons) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.addEventListener("click", fn);
      devbar.appendChild(btn);
    }

    root.parentElement?.appendChild(devbar);
  }

  // Initial paint
  paint();
})().catch(console.error);
