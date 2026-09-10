import { useEffect, useRef, type RefObject } from "react";

const focusable =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(
  active: boolean,
  fallbackFocus?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    if (!active || !dialogRef.current) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const dialog = dialogRef.current;
    const elements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusable));
    const initial =
      dialog.querySelector<HTMLElement>("[data-dialog-initial], [autofocus]") ??
      elements()[0];
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = elements();
      if (items.length === 0) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      fallbackFocus?.current?.focus();
      if (!fallbackFocus?.current) previous?.focus();
    };
  }, [active, fallbackFocus]);

  return dialogRef;
}
