import {useEffect, useState} from "react"
import AuthenticatedLayout from "./components/AuthenticatedLayout"
import {findAppRoute} from "./routes"

function getCurrentRoute() {
    return findAppRoute(window.location.pathname)
}

export default function App() {
    const [currentRoute, setCurrentRoute] = useState(getCurrentRoute)

    useEffect(() => {
        function handlePopState() {
            setCurrentRoute(getCurrentRoute())
        }

        window.addEventListener("popstate", handlePopState)

        return () => window.removeEventListener("popstate", handlePopState)
    }, [])

    function navigate(route: string) {
        const nextRoute = findAppRoute(route)

        if (window.location.pathname !== nextRoute.route) {
            window.history.pushState({}, "", nextRoute.route)
        }

        setCurrentRoute(nextRoute)
    }

    const Page = currentRoute.Page

    return (
        <AuthenticatedLayout
            currentRoute={currentRoute.route}
            onNavigate={navigate}
        >
            <Page/>
        </AuthenticatedLayout>
    )
}