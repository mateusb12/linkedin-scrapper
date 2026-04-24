import type { ReactNode } from "react"
import AppSidebar from "./AppSidebar"
import AppTopbar from "./AppTopbar"

const appShellBackground =
  "min-h-svh bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.1),transparent_32rem),linear-gradient(135deg,#f6f7fb_0%,#eef3f8_100%)] text-[#172033] dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_32rem),linear-gradient(135deg,#0f172a_0%,#111827_100%)] dark:text-slate-50"

type AuthenticatedLayoutProps = {
  children: ReactNode
}

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  return (
    <div className={`${appShellBackground} flex max-[760px]:flex-col`}>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 px-8 py-8 max-[760px]:px-4 max-[760px]:py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
