import {useMemo, useState} from "react"
import {CheckCircle2, Copy, Hash, Sparkles} from "lucide-react"

type SavedJobsExportPanelProps<T> = {
    items: T[]
    onOpenBuilder: () => void
    stringify?: (items: T[]) => string
}

export default function SavedJobsExportPanel<T>({
    items,
    onOpenBuilder,
    stringify = (data) => JSON.stringify(data, null, 2),
}: SavedJobsExportPanelProps<T>) {
    const max = items.length
    const [count, setCount] = useState<number | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    const effectiveCount = count == null ? max : Math.min(count, max)

    const itemsToExport = useMemo(
        () => items.slice(0, effectiveCount),
        [effectiveCount, items],
    )

    async function handleCopy() {
        if (itemsToExport.length === 0) return

        await navigator.clipboard.writeText(stringify(itemsToExport))
        setIsCopied(true)
        window.setTimeout(() => setIsCopied(false), 1800)
    }

    function setSafeCount(value: number) {
        setCount(Math.max(0, Math.min(max, value)))
    }

    return (
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-black uppercase text-emerald-300">
                            <Hash size={14}/>
                            Copy first N ranked jobs
                        </label>
                        <span className="font-mono text-xs text-gray-500">
                            Total: <span className="text-gray-200">{max}</span>
                        </span>
                    </div>

                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                        <span className="font-mono text-xs text-gray-600">0</span>
                        <input
                            type="range"
                            min="0"
                            max={max || 1}
                            value={effectiveCount}
                            onChange={(event) => setSafeCount(Number(event.target.value))}
                            disabled={max === 0}
                            className="h-2 w-full cursor-pointer rounded-lg accent-emerald-500 disabled:opacity-40"
                        />
                        <span className="font-mono text-xs text-gray-600">{max}</span>
                        <input
                            type="number"
                            min="0"
                            max={max}
                            value={effectiveCount}
                            onChange={(event) => setSafeCount(Number(event.target.value))}
                            className="h-9 w-16 rounded border border-gray-700 bg-gray-900 px-2 text-center font-mono text-sm font-bold text-emerald-200 outline-none focus:border-emerald-500"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:pb-0">
                    <button
                        type="button"
                        onClick={onOpenBuilder}
                        disabled={max === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Sparkles size={18}/>
                        Build Context
                    </button>

                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={itemsToExport.length === 0}
                        className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-500 text-gray-950 hover:bg-emerald-400"
                        }`}
                    >
                        {isCopied ? <CheckCircle2 size={18}/> : <Copy size={18}/>}
                        {isCopied ? "Copied" : "Copy JSON"}
                    </button>
                </div>
            </div>
        </section>
    )
}
