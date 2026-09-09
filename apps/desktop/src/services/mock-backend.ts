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
let nextHost = 1;
let nextGroup = 1;
let mockHosts: import("./backend").Host[] = [];
let mockGroups: import("./backend").HostGroup[] = [];
let mockRecentIds: string[] = [];

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
  listHosts: async (search) => {
    const value = search?.trim().toLowerCase();
    return mockHosts.filter(
      (host) =>
        !value ||
        [
          host.name,
          host.address,
          host.username ?? "",
          ...host.tags,
          mockGroups.find((group) => group.id === host.groupId)?.name ?? "",
        ].some((field) => field.toLowerCase().includes(value)),
    );
  },
  listHostGroups: async () =>
    [...mockGroups].sort((left, right) => left.sortOrder - right.sortOrder),
  listRecentHosts: async (limit = 8) =>
    mockRecentIds
      .slice(0, limit)
      .map((id) => mockHosts.find((host) => host.id === id))
      .filter((host): host is import("./backend").Host => Boolean(host)),
  saveHost: async (request) => {
    const current = request.id
      ? mockHosts.find((host) => host.id === request.id)
      : undefined;
    const host = {
      ...request,
      id: request.id ?? "mock-host-" + nextHost++,
      authKind: request.password ? "password" : (current?.authKind ?? "none"),
    } as import("./backend").Host;
    mockHosts = current
      ? mockHosts.map((item) => (item.id === host.id ? host : item))
      : [...mockHosts, host];
    return host;
  },
  deleteHost: async (id) => {
    mockHosts = mockHosts.filter((host) => host.id !== id);
  },
  saveHostGroup: async (request) => {
    const group = {
      id: request.id ?? "mock-group-" + nextGroup++,
      name: request.name.trim(),
      sortOrder: request.sortOrder,
    };
    mockGroups = request.id
      ? mockGroups.map((item) => (item.id === group.id ? group : item))
      : [...mockGroups, group];
    return group;
  },
  deleteHostGroup: async (id, moveHostsToUngrouped) => {
    if (mockHosts.some((host) => host.groupId === id) && !moveHostsToUngrouped)
      throw new Error("group still contains hosts");
    if (moveHostsToUngrouped)
      mockHosts = mockHosts.map((host) =>
        host.groupId === id ? { ...host, groupId: undefined } : host,
      );
    mockGroups = mockGroups.filter((group) => group.id !== id);
  },
  recordRecentHost: async (id) => {
    mockRecentIds = [id, ...mockRecentIds.filter((current) => current !== id)];
  },
};
