"use client";

import { X } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}

export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#f0f7ff] border-b border-[var(--aws-border)] text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-[var(--aws-blue)]">{count} selected</span>
        <button
          onClick={onClear}
          className="text-[var(--aws-text-secondary)] hover:text-[var(--aws-text)] flex items-center gap-0.5"
        >
          <X size={13} /> Clear
        </button>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
