"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { Button } from "./Button";

interface ExportMenuProps {
  onExport: (format: "json" | "bind") => void;
  label?: string;
  size?: "sm" | "md";
}

export function ExportMenu({ onExport, label = "Export", size = "md" }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size={size} onClick={() => setOpen((o) => !o)}>
        <Download size={14} /> {label} <ChevronDown size={12} />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-[var(--aws-surface)] border border-[var(--aws-border)] rounded shadow-lg py-1 text-sm z-20">
          <button
            onClick={() => {
              onExport("json");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text)]"
          >
            Export as JSON
          </button>
          <button
            onClick={() => {
              onExport("bind");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--aws-surface-alt)] text-[var(--aws-text)]"
          >
            Export as BIND zone file
          </button>
        </div>
      )}
    </div>
  );
}
