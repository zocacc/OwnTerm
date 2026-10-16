import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppearanceSettings,
  Backend,
  TerminalAppearanceProfile,
  TerminalColorScheme,
} from "../services/backend";
import { nativeWindow } from "../services/native-window";

export const fallbackScheme: TerminalColorScheme = {
  id: "ownterm-default",
  name: "OwnTerm Default",
  background: "#0c0f15",
  foreground: "#f4f2f8",
  cursor: "#b9a7ff",
  selectionBackground: "#6750a455",
  ansi: [
    "#151820",
    "#ff6b81",
    "#50c878",
    "#f0c674",
    "#7aa2f7",
    "#b9a7ff",
    "#78dce8",
    "#d7dae0",
    "#4b5263",
    "#ff8294",
    "#70e1a8",
    "#ffe08a",
    "#94b6ff",
    "#d3bdff",
    "#9feaf9",
    "#ffffff",
  ],
  builtIn: true,
};
const fallbackProfile: TerminalAppearanceProfile = {
  id: "migrated-appearance",
  name: "OwnTerm Default",
  colorSchemeId: fallbackScheme.id,
  fontFamily: "Cascadia Mono, Consolas, monospace",
  fontSize: 14,
  windowOpacity: 92,
  terminalBackgroundOpacity: 0,
  useAcrylic: true,
  builtIn: false,
};
export const initialAppearance: AppearanceSettings = {
  ...fallbackProfile,
  windowOpacitySupport: "unsupported",
  windowOpacityApplied: false,
  windowOpacityWarning: null,
  backdropConfigured: false,
  backdropRevision: 0,
  backdropWarning: null,
  defaultsApplied: false,
  activeProfileId: fallbackProfile.id,
  profiles: [fallbackProfile],
  colorSchemes: [fallbackScheme],
};

export function useTerminalAppearance(backend: Backend) {
  const [settings, setSettings] = useState(initialAppearance);
  const [ready, setReady] = useState(false);
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState<string>();
  const current = useRef(settings);
  const queue = useRef(Promise.resolve());
  const version = useRef(0);
  const listening = useRef(Promise.resolve());
  const mergeMaterial = useCallback((value: AppearanceSettings) => {
    if (
      (value.backdropRevision ?? 0) >= (current.current.backdropRevision ?? 0)
    )
      return value;
    return {
      ...value,
      backdropConfigured: current.current.backdropConfigured,
      backdropWarning: current.current.backdropWarning,
      backdropRevision: current.current.backdropRevision,
    };
  }, []);
  const mounted = useRef(false);
  const profile =
    settings.profiles.find((item) => item.id === settings.activeProfileId) ??
    fallbackProfile;
  const scheme =
    settings.colorSchemes.find((item) => item.id === profile.colorSchemeId) ??
    fallbackScheme;

  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    listening.current = nativeWindow
      .onBackdropChanged((event) => {
        if (!active) return;
        if (event.revision < (current.current.backdropRevision ?? 0)) return;
        const next = {
          ...current.current,
          backdropConfigured: event.configured,
          backdropRevision: event.revision,
          backdropWarning: event.warning ?? null,
        };
        current.current = next;
        setSettings(next);
      })
      .then((unsubscribe) => {
        if (active) release = unsubscribe;
        else unsubscribe();
      })
      .catch(() => {
        if (active) setError("Could not monitor native Acrylic changes.");
      });
    return () => {
      active = false;
      release?.();
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void listening.current
      .then(() => {
        if (!active) return;
        return (
          backend.getAppearanceSettings?.() ??
          Promise.reject(new Error("unavailable"))
        );
      })
      .then((value) => {
        if (active && value) {
          const next = mergeMaterial(value);
          current.current = next;
          setSettings(next);
          setEditable(true);
        }
      })
      .catch(() => {
        if (active)
          setError("Could not load appearance. Using an opaque fallback.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [backend, mergeMaterial]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--window-opacity",
      String(profile.windowOpacity / 100),
    );
    document.documentElement.dataset.material = settings.backdropConfigured
      ? "backdrop"
      : "opaque";
    return () => {
      document.documentElement.style.removeProperty("--window-opacity");
      delete document.documentElement.dataset.material;
    };
  }, [profile.windowOpacity, settings.backdropConfigured]);

  const update = useCallback(
    (
      changes: Partial<
        Pick<
          TerminalAppearanceProfile,
          "windowOpacity" | "terminalBackgroundOpacity" | "useAcrylic"
        >
      >,
    ) => {
      if (!editable) return;
      const snapshot = current.current;
      const active =
        snapshot.profiles.find(
          (item) => item.id === snapshot.activeProfileId,
        ) ?? fallbackProfile;
      const updated = { ...active, ...changes };
      const next = {
        ...snapshot,
        ...updated,
        activeProfileId: updated.id,
        profiles: snapshot.profiles.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
      current.current = next;
      setSettings(next);
      const saveVersion = ++version.current;
      // Serialize writes as well as ignoring stale responses: otherwise disk can
      // end up with an older slider value even when the UI looks correct.
      queue.current = queue.current
        .then(async () => {
          if (!backend.saveAppearanceSettings) throw new Error("unavailable");
          const saved = await backend.saveAppearanceSettings({
            windowOpacity: updated.windowOpacity,
            terminalBackgroundOpacity: updated.terminalBackgroundOpacity,
            activeProfileId: next.activeProfileId,
            profiles: next.profiles,
            colorSchemes: next.colorSchemes,
          });
          if (mounted.current && saveVersion === version.current) {
            const next = mergeMaterial(saved);
            current.current = next;
            setSettings(next);
            setError(undefined);
          }
        })
        .catch(() => {
          if (mounted.current)
            setError(
              "Could not save appearance. Your changes may not survive a restart.",
            );
        });
    },
    [backend, editable, mergeMaterial],
  );
  return { settings, profile, scheme, ready, editable, error, update };
}
