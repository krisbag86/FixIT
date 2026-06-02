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
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/8 bg-white/70 text-ink shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md dark:border-white/8 dark:bg-white/8 dark:text-paper dark:hover:bg-white/15"
      title={dark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      aria-label={dark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
    >
      {dark ? <Sun size={18} className="transition-transform duration-300 hover:rotate-45" /> : <Moon size={18} className="transition-transform duration-300 hover:-rotate-12" />}
    </button>
  );
}
