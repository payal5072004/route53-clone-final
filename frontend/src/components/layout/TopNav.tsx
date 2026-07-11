"use client";

import { useState } from "react";
import { Search, ChevronDown, Globe2, Moon, Sun, Keyboard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useShortcuts } from "@/lib/shortcuts-context";

export function TopNav() {
  const { username, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setHelpOpen } = useShortcuts();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-12 shrink-0 bg-[var(--aws-navy)] flex items-center px-3 gap-4 text-white z-30 relative">
      <div className="flex items-center gap-2 font-semibold text-sm shrink-0">
        <Globe2 size={20} className="text-[var(--aws-orange)]" />
        <span>Route53</span>
      </div>

      <div className="flex-1 max-w-2xl">
        <div className="flex items-center gap-2 bg-[var(--aws-navy-light)] rounded px-3 py-1.5 text-sm text-gray-300">
          <Search size={14} />
          <input
            placeholder="Search for services, features, hosted zones, and more"
            className="bg-transparent outline-none placeholder:text-gray-400 w-full text-white text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="p-2 rounded hover:bg-[var(--aws-navy-light)]"
        >
          <Keyboard size={16} />
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded hover:bg-[var(--aws-navy-light)]"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded hover:bg-[var(--aws-navy-light)]"
        >
          <span className="w-5 h-5 rounded-full bg-[var(--aws-orange)] flex items-center justify-center text-[10px] font-bold text-white">
            {username?.[0]?.toUpperCase() ?? "U"}
          </span>
          {username ?? "Guest"}
          <ChevronDown size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-44 bg-[var(--aws-surface)] text-[var(--aws-text)] rounded shadow-lg border border-[var(--aws-border)] py-1 text-sm">
            <div className="px-3 py-1.5 text-xs text-[var(--aws-text-secondary)] border-b border-[var(--aws-border)]">
              Signed in as <br />
              <span className="font-semibold text-[var(--aws-text)]">{username}</span>
            </div>
            <button
              onClick={() => logout()}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--aws-surface-alt)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}