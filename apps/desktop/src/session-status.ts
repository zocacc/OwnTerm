import type { SessionStatus } from "./services/backend";

export const sessionStatusLabels: Record<SessionStatus, string> = {
  starting: "Starting",
  awaiting_trust: "Awaiting trust",
  awaiting_credential: "Awaiting credential",
  connected: "Connected",
  disconnected: "Closed",
  failed: "Failed",
};
