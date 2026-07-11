"use client";

import { Modal } from "@/components/ui/Modal";
import { useShortcuts } from "@/lib/shortcuts-context";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { keys: [modKey, "K"], description: "Focus the search box" },
  { keys: ["N"], description: "Create a new hosted zone / record" },
  { keys: ["Esc"], description: "Close the open modal or dialog" },
  { keys: ["?"], description: "Show this shortcuts dialog" },
];

export function ShortcutsHelpDialog() {
  const { helpOpen, setHelpOpen } = useShortcuts();

  if (!helpOpen) return null;

  return (
    <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)} width="max-w-md">
      <ul className="flex flex-col gap-2.5">
        {SHORTCUTS.map((s) => (
          <li key={s.description} className="flex items-center justify-between text-sm">
            <span className="text-[var(--aws-text)]">{s.description}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="px-1.5 py-0.5 rounded border border-[var(--aws-border)] bg-[var(--aws-surface-alt)] text-xs font-mono text-[var(--aws-text-secondary)] min-w-[1.5rem] text-center"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
