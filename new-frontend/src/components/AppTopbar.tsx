import ThemeToggle from "./ThemeToggle"

export default function AppTopbar() {
  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm max-[760px]:px-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="min-w-0">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Frontend Mock
        </p>
        <p className="m-0 mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          LinkedIn scraper dashboard shell
        </p>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  )
}
