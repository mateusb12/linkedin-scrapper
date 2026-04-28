import {useState} from "react"
import {Check, Trophy} from "lucide-react"

import {getScoreTone} from "./savedJobsUtils.ts"

type SavedJobScoreInputProps = {
    initialScore: number
    onSave: (score: number) => void
}

export default function SavedJobScoreInput({
    initialScore,
    onSave,
}: SavedJobScoreInputProps) {
    const [value, setValue] = useState(String(initialScore || 0))
    const [isDirty, setIsDirty] = useState(false)

    function handleChange(nextValue: string) {
        if (nextValue === "") {
            setValue("")
            setIsDirty(true)
            return
        }

        if (!/^\d{0,3}$/.test(nextValue)) return

        const parsed = Number(nextValue)
        if (parsed < 0 || parsed > 100) return

        setValue(nextValue)
        setIsDirty(parsed !== initialScore)
    }

    function handleSave() {
        const parsed = value === "" ? 0 : Number(value)
        const score = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
        onSave(score)
        setIsDirty(false)
    }

    return (
        <div className="flex items-center gap-1.5">
            <label className="relative block w-16">
                <Trophy
                    size={13}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(event) => handleChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") handleSave()
                    }}
                    onBlur={() => {
                        if (isDirty) handleSave()
                    }}
                    aria-label="Job score"
                    className={`h-9 w-full rounded border bg-gray-950 py-1 pl-7 pr-2 text-center font-mono text-sm font-black outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${getScoreTone(Number(value) || 0)}`}
                />
            </label>

            <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                title="Confirm score"
                className={`grid size-9 place-items-center rounded border transition ${
                    isDirty
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                        : "border-gray-800 bg-gray-900 text-gray-600"
                }`}
            >
                <Check size={15} strokeWidth={3}/>
            </button>
        </div>
    )
}
