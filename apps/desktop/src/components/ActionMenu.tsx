import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A small disclosure for existing actions; normal Tab order is preserved. */
export function ActionMenu({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div
      className="action-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        aria-label={label}
        aria-expanded={open}
        className="control-icon"
        ref={trigger}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div
          className="action-menu-panel"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
