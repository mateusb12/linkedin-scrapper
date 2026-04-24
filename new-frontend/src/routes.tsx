import type {ComponentType} from "react"
import type {LucideIcon} from "lucide-react"
import {Bookmark, LayoutGrid, Search, Settings} from "lucide-react"
import HelloWorldPage from "./pages/HelloWorldPage"
import FetchConfigPage from "./pages/FetchConfigPage"
import SavedJobsPage from "./pages/SavedJobsPage"
import SearchJobsPage from "./pages/SearchJobsPage"

export type AppRoute = {
    label: string
    route: string
    icon: LucideIcon
    Page: ComponentType
}

export const appRoutes = [
    {label: "Hello World", icon: LayoutGrid, route: "/", Page: HelloWorldPage},
    {
        label: "Fetch Config",
        icon: Settings,
        route: "/fetch-config",
        Page: FetchConfigPage,
    },
    {label: "Search Jobs", icon: Search, route: "/search", Page: SearchJobsPage},
    {label: "Saved Jobs", icon: Bookmark, route: "/saved", Page: SavedJobsPage},
] as const satisfies readonly AppRoute[]

export function findAppRoute(pathname: string) {
    return appRoutes.find(item => item.route === pathname) ?? appRoutes[0]
}