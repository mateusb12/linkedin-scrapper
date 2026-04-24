import {appRoutes} from "../routes"

const navItemClass =
    "flex min-h-[58px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-600 transition-[background,color,box-shadow] duration-150 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"

const activeNavItemClass =
    "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb] hover:bg-blue-50 dark:bg-blue-950/45 dark:text-blue-200 dark:shadow-[inset_3px_0_0_#60a5fa] dark:hover:bg-blue-950/45"

type AppSidebarProps = {
    currentRoute: string
    onNavigate: (route: string) => void
}

function SidebarUser() {
    return (
        <div className="mt-auto border-t border-slate-200 pt-4 max-[760px]:mt-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
                <div
                    className="grid size-10 flex-none place-items-center rounded-full bg-slate-200 text-sm font-extrabold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">
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
    )
}

export default function AppSidebar({
                                       currentRoute,
                                       onNavigate,
                                   }: AppSidebarProps) {
    return (
        <aside
            className="flex min-h-svh w-[252px] flex-none flex-col border-r border-slate-200/90 bg-white/82 px-4 py-5 shadow-[10px_0_30px_rgba(23,32,51,0.04)] backdrop-blur-xl max-[760px]:min-h-0 max-[760px]:w-full max-[760px]:border-b max-[760px]:border-r-0 max-[760px]:py-4 dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none">
            <div className="flex items-center gap-3 px-1">
                <div
                    className="inline-grid size-10 flex-none place-items-center rounded-lg bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)]">
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

            <nav className="mt-8 grid gap-2.5 max-[760px]:mt-5">
                {appRoutes.map(item => {
                    const Icon = item.icon
                    const isActive = currentRoute === item.route

                    return (
                        <a
                            key={item.route}
                            href={item.route}
                            onClick={event => {
                                event.preventDefault()
                                onNavigate(item.route)
                            }}
                            className={`${navItemClass} ${isActive ? activeNavItemClass : ""}`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <Icon className="size-5 flex-none"/>
                            <span className="min-w-0 truncate text-left">{item.label}</span>
                        </a>
                    )
                })}
            </nav>

            <SidebarUser/>
        </aside>
    )
}