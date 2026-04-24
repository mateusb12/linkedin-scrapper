import { useEffect, useState } from "react"

type ThemeMode = "light" | "dark"

const STORAGE_KEY = "theme"

function getInitialTheme(): ThemeMode {
  const savedTheme = localStorage.getItem(STORAGE_KEY)

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme(currentTheme => (currentTheme === "dark" ? "light" : "dark"))
  }

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
  }
}
