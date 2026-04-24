import { useThemeMode } from "../hooks/useThemeMode"

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useThemeMode()

  return (
    <button
      type="button"
      className="inline-flex h-8 w-[54px] cursor-pointer items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-blue-600/25"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span
        className="relative block h-7 w-[50px] rounded-full bg-[linear-gradient(135deg,#f59e0b,#facc15)] shadow-[0_12px_28px_rgba(23,32,51,0.08)] dark:bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
        aria-hidden="true"
      >
        <span className="absolute left-[3px] top-[3px] grid size-[22px] place-items-center rounded-full bg-white text-[0.82rem] leading-none text-blue-700 transition-[color,transform,background] duration-150 dark:translate-x-[22px] dark:bg-[#172033] dark:text-blue-200">
          {isDark ? (
            <svg viewBox="0 0 24 24" className="size-3.5 fill-current">
              <path d="M20.5 15.2A7.6 7.6 0 0 1 8.8 3.5a8.7 8.7 0 1 0 11.7 11.7Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-3.5 fill-current">
              <path d="M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0-4a1 1 0 0 1 1 1v1.1a1 1 0 1 1-2 0V2.5a1 1 0 0 1 1-1Zm0 18.9a1 1 0 0 1 1 1v1.1a1 1 0 1 1-2 0v-1.1a1 1 0 0 1 1-1ZM4.2 4.2a1 1 0 0 1 1.4 0l.8.8A1 1 0 1 1 5 6.4l-.8-.8a1 1 0 0 1 0-1.4Zm13.4 13.4a1 1 0 0 1 1.4 0l.8.8a1 1 0 0 1-1.4 1.4l-.8-.8a1 1 0 0 1 0-1.4ZM1.5 12a1 1 0 0 1 1-1h1.1a1 1 0 1 1 0 2H2.5a1 1 0 0 1-1-1Zm18.9 0a1 1 0 0 1 1-1h1.1a1 1 0 1 1 0 2h-1.1a1 1 0 0 1-1-1ZM5 17.6A1 1 0 1 1 6.4 19l-.8.8a1 1 0 0 1-1.4-1.4l.8-.8ZM18.4 4.2a1 1 0 0 1 1.4 1.4l-.8.8A1 1 0 1 1 17.6 5l.8-.8Z" />
            </svg>
          )}
        </span>
      </span>
    </button>
  )
}
