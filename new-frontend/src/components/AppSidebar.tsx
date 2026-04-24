const navItemClass =
  "flex min-h-[58px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-600 transition-[background,color,box-shadow] duration-150 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"

const activeNavItemClass =
  "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb] hover:bg-blue-50 dark:bg-blue-950/45 dark:text-blue-200 dark:shadow-[inset_3px_0_0_#60a5fa] dark:hover:bg-blue-950/45"

const sidebarItems = [
  {
    label: "Hello World",
    active: true,
    icon: (
      <svg
        className="size-5 flex-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 13h8V3H3v10Z" />
        <path d="M13 21h8V11h-8v10Z" />
        <path d="M13 3h8v6h-8V3Z" />
        <path d="M3 21h8v-6H3v6Z" />
      </svg>
    ),
  },
  {
    label: "Saved Jobs",
    active: false,
    icon: (
      <svg
        className="size-5 flex-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
      </svg>
    ),
  },
  {
    label: "Job Search",
    active: false,
    icon: (
      <svg
        className="size-5 flex-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    label: "Settings",
    active: false,
    icon: (
      <svg
        className="size-5 flex-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v2.5" />
        <path d="M12 18.5V21" />
        <path d="m4.93 4.93 1.77 1.77" />
        <path d="m17.3 17.3 1.77 1.77" />
        <path d="M3 12h2.5" />
        <path d="M18.5 12H21" />
        <path d="m4.93 19.07 1.77-1.77" />
        <path d="m17.3 6.7 1.77-1.77" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
] as const

export default function AppSidebar() {
  return (
    <aside className="flex min-h-svh w-[252px] flex-none flex-col border-r border-slate-200/90 bg-white/82 px-4 py-5 shadow-[10px_0_30px_rgba(23,32,51,0.04)] backdrop-blur-xl max-[760px]:min-h-0 max-[760px]:w-full max-[760px]:border-b max-[760px]:border-r-0 max-[760px]:py-4 dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none">
      <div className="flex items-center gap-3 px-1">
        <div
          className="inline-grid size-10 flex-none place-items-center rounded-lg bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)]"
          aria-hidden="true"
        >
          LI
        </div>
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-extrabold leading-tight text-[#172033] dark:text-slate-50">
            LinkedIn Scraper
          </p>
          <p className="m-0 mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
            Frontend Mock
          </p>
        </div>
      </div>

      <nav className="mt-8 grid gap-2.5 max-[760px]:mt-5" aria-label="Primary navigation">
        {sidebarItems.map(item => (
          <button
            key={item.label}
            type="button"
            className={`${navItemClass} ${item.active ? activeNavItemClass : ""}`}
            aria-current={item.active ? "page" : undefined}
          >
            {item.icon}
            <span className="min-w-0 truncate text-left">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-200 pt-4 max-[760px]:mt-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="grid size-10 flex-none place-items-center rounded-full bg-slate-200 text-sm font-extrabold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">
            CU
          </div>

          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              Custom User
            </p>
            <p className="m-0 mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              user@example.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
