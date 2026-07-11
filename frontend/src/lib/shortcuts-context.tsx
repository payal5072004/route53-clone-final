"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

interface ShortcutsContextValue {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  registerCreateHandler: (fn: (() => void) | null) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | undefined>(undefined);

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const createHandlerRef = useRef<(() => void) | null>(null);

  const registerCreateHandler = useCallback((fn: (() => void) | null) => {
    createHandlerRef.current = fn;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K -> focus the page's search input, works even while typing elsewhere
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-shortcut-search]");
        el?.focus();
        return;
      }

      // "?" -> toggle shortcuts help
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      // Esc -> close help dialog if open
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }

      // "n" -> trigger the current page's create action (ignored while typing)
      if (
        e.key.toLowerCase() === "n" &&
        !mod &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        createHandlerRef.current
      ) {
        e.preventDefault();
        createHandlerRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  return (
    <ShortcutsContext.Provider value={{ helpOpen, setHelpOpen, registerCreateHandler }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
  return ctx;
}

/** Convenience hook for a page to register its "press N to create" action. */
export function useCreateShortcut(handler: () => void) {
  const { registerCreateHandler } = useShortcuts();
  useEffect(() => {
    registerCreateHandler(handler);
    return () => registerCreateHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handler]);
}
