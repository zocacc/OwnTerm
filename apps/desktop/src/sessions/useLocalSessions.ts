import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Backend,
  SessionDescriptor,
  SessionStatusEvent,
  ShellProfile,
} from "../services/backend";
import type { TerminalHandle } from "../terminal/TerminalSurface";

export type LocalSession = SessionDescriptor & {
  reason?: string;
  exitCode?: number;
};
type PendingOutput = { chunks: number[][]; bytes: number };

export function useLocalSessions(backend: Backend) {
  const [profiles, setProfiles] = useState<ShellProfile[]>([]);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const [initialization, setInitialization] = useState(0);
  const mounted = useRef(false);
  const attempted = useRef(false);
  const openingRef = useRef(false);
  const openingBlocked = useRef(false);
  const known = useRef(new Set<string>());
  const closed = useRef(new Set<string>());
  const handles = useRef(new Map<string, TerminalHandle>());
  const output = useRef(new Map<string, PendingOutput>());
  const statuses = useRef(new Map<string, Partial<LocalSession>>());
  const defaultProfile =
    profiles.find((item) => /powershell|pwsh/i.test(item.id + item.name)) ??
    profiles.find((item) => /cmd|command prompt/i.test(item.id + item.name)) ??
    profiles[0];
  const reportError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let cleanups: Array<() => void> = [];
    const status = (event: SessionStatusEvent) => {
      if (!active || event.version !== 1 || closed.current.has(event.sessionId))
        return;
      if (known.current.has(event.sessionId)) {
        setSessions((items) =>
          items.map((item) =>
            item.id === event.sessionId
              ? { ...item, status: event.status, reason: event.reason }
              : item,
          ),
        );
      } else if (statuses.current.size < 32) {
        statuses.current.set(event.sessionId, {
          status: event.status,
          reason: event.reason,
        });
      }
    };
    const subscriptions = [
      backend.onSessionOutput((event) => {
        if (
          !active ||
          event.version !== 1 ||
          closed.current.has(event.sessionId)
        )
          return;
        const handle = handles.current.get(event.sessionId);
        if (handle) {
          handle.write(event.data);
          return;
        }
        if (!output.current.has(event.sessionId) && output.current.size >= 8)
          return;
        const pending = output.current.get(event.sessionId) ?? {
          chunks: [],
          bytes: 0,
        };
        const chunk = event.data.slice(0, Math.max(0, 65_536 - pending.bytes));
        if (chunk.length) {
          pending.chunks.push(chunk);
          pending.bytes += chunk.length;
        }
        output.current.set(event.sessionId, pending);
      }),
      backend.onSessionStatus(status),
      backend.onSessionExit((event) => {
        if (
          !active ||
          event.version !== 1 ||
          closed.current.has(event.sessionId)
        )
          return;
        const update = {
          status: "disconnected" as const,
          exitCode: event.exitCode,
        };
        if (known.current.has(event.sessionId)) {
          setSessions((items) =>
            items.map((item) =>
              item.id === event.sessionId ? { ...item, ...update } : item,
            ),
          );
        } else if (statuses.current.size < 32)
          statuses.current.set(event.sessionId, update);
      }),
      // This foundation starts local sessions only. Never accept an unexpected
      // SSH identity or provide a secret on behalf of a user.
      backend.onSessionTrustRequired((event) => {
        if (active && event.version === 1)
          void backend
            .confirmSshTrust(event.sessionId, false)
            .catch(() => undefined);
      }),
      backend.onSessionCredentialRequired((event) => {
        if (active && event.version === 1)
          void backend
            .provideSshCredential(event.sessionId)
            .catch(() => undefined);
      }),
    ];
    void Promise.allSettled(subscriptions).then(async (results) => {
      const failure = results.some((result) => result.status === "rejected");
      const releases = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (!active || failure) {
        releases.forEach((release) => release());
        if (active)
          setError(
            "Could not prepare terminal events. Use Retry to initialize again.",
          );
        return;
      }
      cleanups = releases;
      try {
        const available = await backend.listShellProfiles();
        if (!active) return;
        setProfiles(available);
        setReady(true);
        if (!available.length)
          setError(
            "No local shells detected. Install PowerShell or CMD, then use Retry.",
          );
      } catch {
        if (active)
          setError(
            "Could not discover local shells. Use Retry to initialize again.",
          );
      }
    });
    return () => {
      active = false;
      mounted.current = false;
      cleanups.forEach((release) => release());
    };
  }, [backend, initialization]);

  const open = useCallback(
    async (profileId = defaultProfile?.id) => {
      if (!ready || !profileId || openingRef.current || openingBlocked.current)
        return;
      openingRef.current = true;
      setOpening(true);
      setError(undefined);
      try {
        const descriptor = await backend.startLocalSession(profileId, 24, 80);
        if (!mounted.current) {
          await backend.closeSession(descriptor.id);
          return;
        }
        known.current.add(descriptor.id);
        closed.current.delete(descriptor.id);
        const pending = statuses.current.get(descriptor.id);
        statuses.current.delete(descriptor.id);
        setSessions((items) => [...items, { ...descriptor, ...pending }]);
        setActiveId(descriptor.id);
      } catch {
        if (mounted.current)
          setError(
            "Could not start the shell. Use Retry or choose another shell.",
          );
      } finally {
        openingRef.current = false;
        if (mounted.current) setOpening(false);
      }
    },
    [backend, defaultProfile?.id, ready],
  );

  useEffect(() => {
    if (ready && defaultProfile && !attempted.current) {
      attempted.current = true;
      void open();
    }
  }, [ready, defaultProfile, open]);

  const register = useCallback((id: string, handle?: TerminalHandle) => {
    if (!handle) {
      handles.current.delete(id);
      return;
    }
    if (closed.current.has(id)) return;
    handles.current.set(id, handle);
    output.current.get(id)?.chunks.forEach((chunk) => handle.write(chunk));
    output.current.delete(id);
  }, []);

  const close = useCallback(
    async (id: string) => {
      try {
        await backend.closeSession(id);
      } catch {
        setError("Could not close the session. The tab was kept open.");
        return false;
      }
      closed.current.add(id);
      if (closed.current.size > 128)
        closed.current.delete(closed.current.values().next().value!);
      known.current.delete(id);
      handles.current.delete(id);
      output.current.delete(id);
      statuses.current.delete(id);
      setSessions((items) => items.filter((item) => item.id !== id));
      return true;
    },
    [backend],
  );

  const cycle = useCallback(
    (direction: number) => {
      if (!sessions.length) return;
      const index = sessions.findIndex((item) => item.id === activeId);
      setActiveId(
        sessions[(index + direction + sessions.length) % sessions.length].id,
      );
    },
    [activeId, sessions],
  );
  const blockOpening = useCallback((blocked: boolean) => {
    openingBlocked.current = blocked;
  }, []);

  const retry = useCallback(() => {
    if (!ready || !profiles.length) {
      setError(undefined);
      setReady(false);
      setInitialization((value) => value + 1);
    } else {
      void open();
    }
  }, [ready, profiles.length, open]);

  return {
    profiles,
    sessions,
    activeId,
    select: setActiveId,
    ready,
    opening,
    error,
    reportError,
    open,
    retry,
    blockOpening,
    close,
    cycle,
    register,
    handles,
  };
}
