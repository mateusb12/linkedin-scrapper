const statCards = [
  {
    title: "Saved jobs",
    value: "24",
    detail: "Static counter for the shell preview.",
  },
  {
    title: "Search pipelines",
    value: "3",
    detail: "Placeholder workflows for future UI sections.",
  },
] as const

const activityItems = [
  "Shell layout mirrors the source dashboard structure.",
  "Theme mode persists in localStorage under theme.",
  "Navigation is static and intentionally non-functional.",
] as const

export default function HelloWorldPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-400/30 dark:bg-blue-950/40 dark:text-blue-200">
          Mocked UI shell
        </span>
        <h1 className="m-0 mt-4 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
          Hello World
        </h1>
        <p className="m-0 mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
          This is a frontend-only dashboard mock inspired by the reference
          project layout, spacing, translucent surfaces, and dark mode
          behavior.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {statCards.map(card => (
          <article
            key={card.title}
            className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90"
          >
            <p className="m-0 text-sm font-extrabold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
              {card.title}
            </p>
            <p className="m-0 mt-4 text-4xl font-black tracking-tight text-[#172033] dark:text-slate-50">
              {card.value}
            </p>
            <p className="m-0 mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              {card.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-[#172033]/90">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="m-0 text-xl font-black tracking-tight text-[#172033] dark:text-slate-50">
              What this mock includes
            </h2>
            <p className="m-0 mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              The cards are fake content designed only to validate the shell and
              overall dashboard presentation.
            </p>
          </div>
          <span className="inline-flex h-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            No API calls
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          {activityItems.map(item => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-lg border border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-700/90 dark:bg-slate-900/70"
            >
              <span className="mt-1 inline-block size-2 rounded-full bg-emerald-500" />
              <p className="m-0 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
