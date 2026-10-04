import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function ToolbarMenu({ label, accessibleLabel, disabled, selected, filter, children }: {
  label: string; accessibleLabel: string; disabled: boolean; selected?: boolean; filter?: boolean; children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && root.current) root.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => { if (disabled && root.current) root.current.open = false; }, [disabled]);
  return <details ref={root} className="toolbar-menu"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
    <summary role="button" className={`${filter ? "filter" : "toolbar-trigger"}${selected ? " selected" : ""}`}
      aria-label={accessibleLabel} aria-disabled={disabled}
      onClick={event => { if (disabled) event.preventDefault(); }}>
      {label}<ChevronDown size={14} aria-hidden="true" />
    </summary>
    <div className="toolbar-popup" onClick={event => {
      if ((event.target as Element).closest("button:not(:disabled)") && root.current) {
        root.current.open = false; root.current.querySelector("summary")?.focus();
      }
    }}>{children}</div>
  </details>;
}
