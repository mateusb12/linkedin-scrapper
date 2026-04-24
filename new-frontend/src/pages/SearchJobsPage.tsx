export default function SearchJobsPage() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section
                className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
                <h1 className="m-0 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
                    Search Jobs
                </h1>
                <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Mock page for searching jobs without backend calls.
                </p>
            </section>
        </div>
    )
}