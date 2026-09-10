import type { UpdateInfo } from "../platform/platform";

declare const __APP_VERSION__: string;

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; version: string; url: string }
  | { kind: "failed" };

export function updateMessage(s: UpdateState): string {
  switch (s.kind) {
    case "idle":
      return "";
    case "checking":
      return "Checking…";
    case "latest":
      return "You're up to date.";
    case "available":
      return `Version ${s.version} is available.`;
    case "failed":
      return "Couldn't check. Are you online?";
  }
}

export function stateFromResult(info: UpdateInfo): UpdateState {
  if (info.isNewer) {
    return {
      kind: "available",
      version: info.latest,
      url: info.url,
    };
  }
  return { kind: "latest" };
}
