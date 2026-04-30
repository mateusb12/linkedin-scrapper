import {useEffect, useMemo, useState} from "react"
import {ChevronDown} from "lucide-react"

import {appRoutes, type AppRoute} from "../routes"

const navItemClass =
    "flex min-h-[58px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-600 transition-[background,color,box-shadow] duration-150 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"

const activeNavItemClass =
    "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb] hover:bg-blue-50 dark:bg-blue-950/45 dark:text-blue-200 dark:shadow-[inset_3px_0_0_#60a5fa] dark:hover:bg-blue-950/45"

const groupButtonClass =
    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"

const groupTitleClass = "min-w-0 truncate"

const groupItemsWrapperClass = "grid gap-2 pl-2"

const sidebarGroups = [
    {
        title: "Setup",
        items: ["Fetch Config"],
    },
    {
        title: "Discovery",
        items: ["Search Jobs", "Saved Jobs"],
    },
    {
        title: "Apply",
        items: ["Profile", "Applied Jobs"],
    },
    {
        title: "Analytics",
        items: ["Insights", "Rejections"],
    },
    {
        title: "Dev / Debug",
        items: ["Hello World"],
    },
] as const

type SidebarGroup = {
    title: string
    items: AppRoute[]
}

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
    const groupedRoutes = useMemo<SidebarGroup[]>(() => {
        const routeByLabel = new Map(appRoutes.map(item => [item.label, item]))
        const groupedLabels = new Set<string>()
        const groups: SidebarGroup[] = sidebarGroups.map(group => {
            const items = group.items.flatMap(label => {
                const route = routeByLabel.get(label)

                if (!route) {
                    return []
                }

                groupedLabels.add(label)
                return [route]
            })

            return {
                title: group.title,
                items,
            }
        })

        const otherItems = appRoutes.filter(item => !groupedLabels.has(item.label))

        if (otherItems.length > 0) {
            groups.push({
                title: "Other",
                items: otherItems,
            })
        }

        return groups.filter(group => group.items.length > 0)
    }, [])

    const activeGroupTitle = useMemo(() => {
        return groupedRoutes.find(group =>
            group.items.some(item => item.route === currentRoute),
        )?.title
    }, [currentRoute, groupedRoutes])

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
        activeGroupTitle ? {[activeGroupTitle]: true} : {},
    )

    useEffect(() => {
        if (!activeGroupTitle) {
            return
        }

        setOpenGroups(prevOpenGroups => {
            if (prevOpenGroups[activeGroupTitle]) {
                return prevOpenGroups
            }

            return {
                ...prevOpenGroups,
                [activeGroupTitle]: true,
            }
        })
    }, [activeGroupTitle])

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

            <nav className="mt-8 grid gap-3 max-[760px]:mt-5">
                {groupedRoutes.map(group => {
                    const isOpen = openGroups[group.title] ?? false

                    return (
                        <section key={group.title} className="grid gap-2">
                            <button
                                type="button"
                                className={groupButtonClass}
                                onClick={() => {
                                    setOpenGroups(prevOpenGroups => ({
                                        ...prevOpenGroups,
                                        [group.title]: !isOpen,
                                    }))
                                }}
                                aria-expanded={isOpen}
                            >
                                <span className={groupTitleClass}>{group.title}</span>
                                <ChevronDown
                                    className={`size-4 flex-none transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                                    aria-hidden="true"
                                />
                            </button>

                            {isOpen ? (
                                <div className={groupItemsWrapperClass}>
                                    {group.items.map(item => {
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
                                </div>
                            ) : null}
                        </section>
                    )
                })}
            </nav>

            <SidebarUser/>
        </aside>
    )
}
