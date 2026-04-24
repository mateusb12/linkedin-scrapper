import ThemeToggle from "./ThemeToggle"

export default function AppTopbar() {
  return (
    <header className="sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b border-slate-300/90 bg-white/92 px-8 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl max-[760px]:px-4 dark:border-slate-700/90 dark:bg-slate-950/88 dark:shadow-[0_10px_24px_rgba(2,6,23,0.45)]">
      <div className="min-w-0">
        <p className="m-0 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Frontend Mock
        </p>
        <p className="m-0 mt-1 truncate text-sm font-bold text-slate-700 dark:text-slate-200">
          LinkedIn scraper dashboard shell
        </p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  )
}
