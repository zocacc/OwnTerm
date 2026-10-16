import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type BackdropChange = {
  configured: boolean;
  revision: number;
  warning?: string;
};

export const nativeWindow = {
  async onBackdropChanged(
    handler: (event: BackdropChange) => void,
  ): Promise<() => void> {
    if (!isTauri()) return () => undefined;
    return getCurrentWindow().listen<BackdropChange>(
      "native-backdrop-changed",
      (event) => handler(event.payload),
    );
  },
  async close() {
    if (isTauri()) await getCurrentWindow().close();
  },
  async onCloseRequested(
    handler: () => void,
    permitted: () => boolean,
  ): Promise<() => void> {
    if (!isTauri()) return () => undefined;
    return getCurrentWindow().onCloseRequested((event) => {
      if (!permitted()) {
        event.preventDefault();
        handler();
      }
    });
  },
};
