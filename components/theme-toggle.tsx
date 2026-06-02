"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("fixit-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white/70 text-ink shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-paper dark:hover:bg-white/15"
      title={dark ? "Wlacz jasny motyw" : "Wlacz ciemny motyw"}
      aria-label={dark ? "Wlacz jasny motyw" : "Wlacz ciemny motyw"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
