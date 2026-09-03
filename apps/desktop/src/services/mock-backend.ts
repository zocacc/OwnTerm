import type {
  Backend,
  SessionExitEvent,
  SessionOutputEvent,
  SessionStatusEvent,
} from "./backend";

const outputHandlers = new Set<(event: SessionOutputEvent) => void>();
const statusHandlers = new Set<(event: SessionStatusEvent) => void>();
const exitHandlers = new Set<(event: SessionExitEvent) => void>();
let nextSession = 1;

function subscribe<T>(
  handlers: Set<(event: T) => void>,
  handler: (event: T) => void,
) {
  handlers.add(handler);
  return Promise.resolve(() => handlers.delete(handler));
}

export const mockBackend: Backend = {
  appInfo: async () => ({ name: "OwnTerm", version: "0.1.0" }),
  listShellProfiles: async () => [
    { id: "browser-demo", name: "Shell de demonstração" },
  ],
  startLocalSession: async (shellProfileId) => ({
    id: `mock-session-${nextSession++}`,
    kind: { type: "local", shellProfileId },
    title: "Shell de demonstração",
    status: "connected",
  }),
  writeSession: async (sessionId, data) => {
    queueMicrotask(() => {
      for (const handler of outputHandlers) {
        handler({ version: 1, sessionId, data });
      }
    });
  },
  resizeSession: async () => undefined,
  closeSession: async (sessionId) => {
    queueMicrotask(() => {
      for (const handler of exitHandlers) {
        handler({ version: 1, sessionId });
      }
    });
  },
  onSessionOutput: (handler) => subscribe(outputHandlers, handler),
  onSessionStatus: (handler) => subscribe(statusHandlers, handler),
  onSessionExit: (handler) => subscribe(exitHandlers, handler),
};
