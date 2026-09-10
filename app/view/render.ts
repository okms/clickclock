/**
 * DOM updates for the view.
 * Uses data-slot attributes to find nodes; no innerHTML for user data (textContent only).
 */
import type { ViewModel } from "./model";
import type { Settings } from "../../core/types";
import type { HistoryWeek } from "../../core/store";
import { formatDecimalHours, formatHHMM } from "../../core/format";
import type { UpdateState } from "./updates";
import { updateMessage } from "./updates";

declare const __APP_VERSION__: string;

export interface UiState {
  view: "main" | "history" | "settings";
  confirm: boolean;
  copied: boolean;
  loginHelp: string;
  history: HistoryWeek[];
  settings: Settings;
  update: UpdateState;
}

function $(root: HTMLElement, slot: string): HTMLElement | null {
  return root.querySelector(`[data-slot="${slot}"]`);
}

export function render(root: HTMLElement, vm: ViewModel, ui: UiState): void {
  // Update data-state attribute for styling
  root.dataset.state = vm.stateKind;

  // Update main view visibility
  const mainView = root.querySelector('[data-view="main"]');
  const historyView = root.querySelector('[data-view="history"]');
  const settingsView = root.querySelector('[data-view="settings"]');

  mainView?.classList.toggle("is-active", ui.view === "main");
  historyView?.classList.toggle("is-active", ui.view === "history");
  settingsView?.classList.toggle("is-active", ui.view === "settings");

  // Main view header visibility
  const stateHeader = $(root, "state-header");
  const icons = $(root, "icons");
  const back = $(root, "back");

  if (stateHeader) (stateHeader as HTMLElement).hidden = ui.view !== "main";
  if (icons) (icons as HTMLElement).hidden = ui.view !== "main";
  if (back) (back as HTMLElement).hidden = ui.view === "main";

  // State row
  if (ui.view === "main") {
    const stateWord = root.querySelector(".state-word");
    if (stateWord) stateWord.textContent = vm.stateWord;

    const stateWhy = root.querySelector(".state-why");
    if (stateWhy) {
      stateWhy.textContent = vm.why;
      (stateWhy as HTMLElement).hidden = vm.why === "";
    }

    // Date label
    const date = $(root, "date");
    if (date) date.textContent = vm.dateLabel;

    // Figure
    const hours = $(root, "hours");
    if (hours) hours.textContent = vm.primary;

    const hhmm = $(root, "hhmm");
    if (hhmm) hhmm.textContent = vm.secondary;

    // Primary button
    const primary = $(root, "primary");
    if (primary) {
      primary.textContent = vm.primaryLabel;
      (primary as HTMLButtonElement).disabled = false; // Always enabled, controlled via state styling
    }

    // Clear button
    const clear = $(root, "clear");
    if (clear) {
      (clear as HTMLButtonElement).disabled = !vm.canClear;
    }

    // Confirmation UI
    const actions = $(root, "actions");
    const confirm = $(root, "confirm");
    if (actions) actions.classList.toggle("is-confirm", ui.confirm);
    if (confirm) confirm.classList.toggle("is-on", ui.confirm);

    // Confirmation text
    const confirmText = $(root, "confirm-text");
    if (confirmText) {
      confirmText.textContent = `Clear today's ${vm.hhmm}?`;
    }

    // Note
    const note = $(root, "note");
    if (note) note.textContent = vm.note;

    // Copied indicator
    const copied = $(root, "copied");
    if (copied) {
      copied.classList.toggle("is-on", ui.copied);
      copied.textContent = "Copied";
    }
  }

  // History view
  if (ui.view === "history") {
    const list = $(root, "list");
    if (list) {
      list.innerHTML = "";

      if (!ui.history || ui.history.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent =
          "Nothing yet. Previous days appear here once you have worked a full day.";
        list.appendChild(li);
      } else {
        for (const week of ui.history) {
          // Week row
          const weekRow = document.createElement("li");
          weekRow.className = "row week";

          const weekName = document.createElement("span");
          weekName.textContent = week.label;

          const weekTime = document.createElement("span");
          weekTime.className = "num time";
          weekTime.textContent = formatHHMM(week.seconds);
          weekTime.title = "Click to copy";

          const weekDec = document.createElement("span");
          weekDec.className = "num dec";
          weekDec.textContent = formatDecimalHours(week.seconds);

          weekRow.append(weekName, weekTime, weekDec);
          list.appendChild(weekRow);

          // Day rows
          for (const day of week.days) {
            const dayRow = document.createElement("li");
            dayRow.className = "row";

            const dayName = document.createElement("span");
            dayName.textContent = day.label;

            const dayTime = document.createElement("span");
            dayTime.className = "num time";
            dayTime.textContent = formatHHMM(day.seconds);
            dayTime.title = "Click to copy";

            const dayDec = document.createElement("span");
            dayDec.className = "num dec";
            dayDec.textContent = formatDecimalHours(day.seconds);

            dayRow.append(dayName, dayTime, dayDec);
            list.appendChild(dayRow);
          }
        }
      }
    }
  }

  // Settings view
  if (ui.view === "settings") {
    const threshold = $(root, "threshold");
    if (threshold && threshold instanceof HTMLSelectElement) {
      const thresholdStr = `${ui.settings.idleThresholdMinutes} minute${
        ui.settings.idleThresholdMinutes === 1 ? "" : "s"
      }`;
      for (let i = 0; i < threshold.options.length; i++) {
        const opt = threshold.options[i];
        if (opt) {
          opt.selected = opt.textContent === thresholdStr;
        }
      }
    }

    const autoResume = $(root, "autoresume");
    if (autoResume) {
      autoResume.setAttribute("aria-checked", String(ui.settings.autoResume));
    }

    const login = $(root, "login");
    if (login) {
      login.setAttribute("aria-checked", String(ui.settings.launchAtLogin));
    }

    const loginHelp = $(root, "login-help");
    if (loginHelp) {
      loginHelp.textContent = ui.loginHelp;
      (loginHelp as HTMLElement).hidden = ui.loginHelp === "";
    }

    const traytime = $(root, "traytime");
    if (traytime) {
      traytime.setAttribute("aria-checked", String(ui.settings.showTimeInTray));
    }

    const version = $(root, "version");
    if (version) {
      version.textContent = __APP_VERSION__;
    }

    const updateResult = $(root, "update-result");
    if (updateResult) {
      updateResult.textContent = updateMessage(ui.update);
    }

    const checkUpdates = $(root, "check-updates");
    if (checkUpdates && checkUpdates instanceof HTMLButtonElement) {
      checkUpdates.disabled = ui.update.kind === "checking";
    }

    const openRelease = $(root, "open-release");
    if (openRelease) {
      (openRelease as HTMLElement).hidden = ui.update.kind !== "available";
    }
  }
}
