import {useEffect, useMemo, useState} from "react"
import {
    BookOpen,
    BriefcaseBusiness,
    Check,
    Copy,
    FileCode2,
    FileJson,
    Languages,
    Plus,
    RefreshCw,
    Save,
    Sparkles,
    Trash2,
    UserRound,
} from "lucide-react"
import type {LucideIcon} from "lucide-react"

import {
    deleteResumeMock,
    duplicateResumeMock,
    fetchProfileMock,
    fetchResumesMock,
    resetProfileMock,
    saveProfileMock,
    saveResumeMock,
    type CareerProfile,
    type ResumeDraft,
    type ResumeEducation,
    type ResumeExperience,
    type ResumeLanguage,
    type ResumeLanguageItem,
    type ResumeProject,
    type ResumeSkillMap,
} from "./profileMockService"
import {
    buildFinalPrompt,
    generateResumeExport,
    getLanguageLabel,
    getPromptTemplate,
    getResumeFlag,
    listToText,
    normalizeList,
} from "./profileResumeUtils"

type ExportFormat = "latex" | "json"

const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-[#101827] dark:text-slate-100"

const textareaClass = `${inputClass} min-h-24 resize-y font-normal leading-6`

const skillKeys: Array<keyof ResumeSkillMap> = [
    "languages",
    "frameworks",
    "cloud_and_infra",
    "databases",
    "concepts",
]

const skillLabels: Record<keyof ResumeSkillMap, string> = {
    languages: "Languages",
    frameworks: "Frameworks",
    cloud_and_infra: "Cloud and Infra",
    databases: "Databases",
    concepts: "Concepts",
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

function Field({
                   label,
                   value,
                   onChange,
                   placeholder,
               }: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </span>
            <input
                value={value}
                onChange={event => onChange(event.target.value)}
                placeholder={placeholder}
                className={inputClass}
            />
        </label>
    )
}

function TextareaField({
                           label,
                           value,
                           onChange,
                           rows = 4,
                           placeholder,
                       }: {
    label: string
    value: string
    onChange: (value: string) => void
    rows?: number
    placeholder?: string
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </span>
            <textarea
                value={value}
                onChange={event => onChange(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                className={textareaClass}
            />
        </label>
    )
}

function IconButton({
                        label,
                        onClick,
                        children,
                        tone = "slate",
                        disabled = false,
                    }: {
    label: string
    onClick: () => void
    children: React.ReactNode
    tone?: "slate" | "blue" | "emerald" | "red"
    disabled?: boolean
}) {
    const tones = {
        slate:
            "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        blue: "border-blue-500 bg-blue-600 text-white hover:bg-blue-700",
        emerald: "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700",
        red: "border-red-400 text-red-600 hover:bg-red-50 dark:border-red-500/70 dark:text-red-300 dark:hover:bg-red-950/50",
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
        >
            {children}
        </button>
    )
}

function Section({
                     title,
                     icon,
                     children,
                     action,
                 }: {
    title: string
    icon: React.ReactNode
    children: React.ReactNode
    action?: React.ReactNode
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#172033]">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-50">
                    {icon}
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    )
}

function updateAt<T>(items: T[], index: number, updater: (value: T) => T) {
    return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item))
}

function removeAt<T>(items: T[], index: number) {
    return items.filter((_, itemIndex) => itemIndex !== index)
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<CareerProfile | null>(null)
    const [resumes, setResumes] = useState<ResumeDraft[]>([])
    const [activeResumeId, setActiveResumeId] = useState<number | null>(null)
    const [format, setFormat] = useState<ExportFormat>("latex")
    const [jobDescription, setJobDescription] = useState("")
    const [includeAtsHiddenKeywords, setIncludeAtsHiddenKeywords] = useState(false)
    const [promptTemplate, setPromptTemplate] = useState(getPromptTemplate("PTBR"))
    const [copied, setCopied] = useState<"resume" | "prompt" | null>(null)
    const [status, setStatus] = useState("Mock localStorage")

    useEffect(() => {
        async function load() {
            const [nextProfile, nextResumes] = await Promise.all([
                fetchProfileMock(),
                fetchResumesMock(),
            ])

            setProfile(nextProfile)
            setResumes(nextResumes)
            setActiveResumeId(nextResumes[0]?.id ?? null)
            setPromptTemplate(getPromptTemplate(nextResumes[0]?.language ?? "PTBR"))
        }

        void load()
    }, [])

    const activeResume = resumes.find(resume => resume.id === activeResumeId) ?? null

    const resumeExport = useMemo(() => {
        if (!activeResume || !profile) return ""

        return generateResumeExport(activeResume, profile, format, includeAtsHiddenKeywords)
    }, [activeResume, format, includeAtsHiddenKeywords, profile])

    const finalPrompt = useMemo(
        () =>
            buildFinalPrompt({
                template: promptTemplate,
                jobDescription,
                resumeContent: resumeExport,
            }),
        [jobDescription, promptTemplate, resumeExport],
    )
    const statCards: Array<{ label: string; value: number; Icon: LucideIcon }> = [
        {label: "Experiences", value: activeResume?.experiences.length ?? 0, Icon: BriefcaseBusiness},
        {
            label: "Skills",
            value: activeResume
                ? Object.values(activeResume.skills).reduce((sum, items) => sum + items.length, 0)
                : 0,
            Icon: Sparkles,
        },
        {label: "Languages", value: activeResume?.languages.length ?? 0, Icon: Languages},
        {label: "Education", value: activeResume?.education.length ?? 0, Icon: BookOpen},
    ]

    const updateProfile = (updater: (value: CareerProfile) => CareerProfile) => {
        setProfile(current => (current ? updater(current) : current))
    }

    const updateResume = (updater: (value: ResumeDraft) => ResumeDraft) => {
        if (!activeResume) return
        setResumes(current =>
            current.map(resume => (resume.id === activeResume.id ? updater(resume) : resume)),
        )
    }

    const handleSave = async () => {
        if (!profile || !activeResume) return

        await saveProfileMock(profile)
        await saveResumeMock(activeResume)
        setStatus(`Saved ${activeResume.internalName}`)
    }

    const handleDuplicate = async () => {
        if (!activeResume) return

        const copy = await duplicateResumeMock(activeResume.id)
        setResumes(current => [...current, copy])
        setActiveResumeId(copy.id)
        setPromptTemplate(getPromptTemplate(copy.language))
        setStatus(`Duplicated ${activeResume.internalName}`)
    }

    const handleDelete = async () => {
        if (!activeResume || resumes.length <= 1) return

        const next = await deleteResumeMock(activeResume.id)
        setResumes(next)
        setActiveResumeId(next[0]?.id ?? null)
        setStatus(`Deleted ${activeResume.internalName}`)
    }

    const handleReset = async () => {
        const next = await resetProfileMock()
        setProfile(next.profile)
        setResumes(next.resumes)
        setActiveResumeId(next.resumes[0]?.id ?? null)
        setPromptTemplate(getPromptTemplate(next.resumes[0]?.language ?? "PTBR"))
        setJobDescription("")
        setIncludeAtsHiddenKeywords(false)
        setStatus("Reset to SQLite seed")
    }

    const handleCopy = async (kind: "resume" | "prompt", value: string) => {
        await navigator.clipboard.writeText(value)
        setCopied(kind)
        window.setTimeout(() => setCopied(null), 1400)
    }

    const addExperience = () => {
        updateResume(resume => ({
            ...resume,
            experiences: [
                ...resume.experiences,
                {
                    id: makeId("exp"),
                    company: "",
                    role: "",
                    location: "",
                    startDate: "",
                    endDate: "",
                    highlights: [""],
                    stack: [],
                },
            ],
        }))
    }

    const addProject = () => {
        updateResume(resume => ({
            ...resume,
            projects: [
                ...resume.projects,
                {
                    id: makeId("project"),
                    name: "",
                    description: "",
                    stack: [],
                    links: {github: "", website: ""},
                },
            ],
        }))
    }

    const addEducation = () => {
        updateResume(resume => ({
            ...resume,
            education: [
                ...resume.education,
                {
                    id: makeId("edu"),
                    institution: "",
                    degree: "",
                    location: "",
                    startYear: "",
                    endYear: "",
                    year: "",
                },
            ],
        }))
    }

    const addLanguage = () => {
        updateResume(resume => ({
            ...resume,
            languages: [...resume.languages, {id: makeId("lang"), name: "", level: ""}],
        }))
    }

    if (!profile || !activeResume) {
        return (
            <main className="min-h-svh bg-slate-100 p-8 text-slate-900 dark:bg-[#101827] dark:text-slate-50">
                Loading profile...
            </main>
        )
    }

    return (
        <main className="min-h-svh bg-slate-100 text-slate-900 dark:bg-[#101827] dark:text-slate-50">
            <header className="border-b border-slate-800 bg-[#0f172a] px-5 py-5 text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-blue-300">
                            Mocked profile builder
                        </p>
                        <h1 className="mt-1 text-3xl font-black tracking-normal">
                            Profile
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={activeResume.id}
                            onChange={event => {
                                const nextId = Number(event.target.value)
                                const nextResume = resumes.find(resume => resume.id === nextId)
                                setActiveResumeId(nextId)
                                setPromptTemplate(getPromptTemplate(nextResume?.language ?? "PTBR"))
                            }}
                            className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-blue-400"
                        >
                            {resumes.map(resume => (
                                <option key={resume.id} value={resume.id}>
                                    {getResumeFlag(resume.language)} {resume.internalName} ({getLanguageLabel(resume.language)})
                                </option>
                            ))}
                        </select>

                        <IconButton label="Duplicate resume" onClick={handleDuplicate}>
                            <Copy size={16}/>
                            Duplicate
                        </IconButton>
                        <IconButton label="Save mock data" onClick={handleSave} tone="emerald">
                            <Save size={16}/>
                            Save
                        </IconButton>
                        <IconButton
                            label="Delete resume"
                            onClick={handleDelete}
                            tone="red"
                            disabled={resumes.length <= 1}
                        >
                            <Trash2 size={16}/>
                        </IconButton>
                        <IconButton label="Reset mock data" onClick={handleReset}>
                            <RefreshCw size={16}/>
                        </IconButton>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
                <div className="grid gap-3 md:grid-cols-4">
                    {statCards.map(({label, value, Icon}) => (
                        <section
                            key={label}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#172033]"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {label}
                                </p>
                                <Icon className="size-5 text-blue-500"/>
                            </div>
                            <p className="mt-2 text-3xl font-black">{value}</p>
                        </section>
                    ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="grid gap-5">
                        <Section title="Global Profile" icon={<UserRound className="size-5 text-blue-500"/>}>
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Name" value={profile.name}
                                       onChange={value => updateProfile(item => ({...item, name: value}))}/>
                                <Field label="Email" value={profile.email}
                                       onChange={value => updateProfile(item => ({...item, email: value}))}/>
                                <Field label="Phone" value={profile.phone}
                                       onChange={value => updateProfile(item => ({...item, phone: value}))}/>
                                <Field label="Location" value={profile.location}
                                       onChange={value => updateProfile(item => ({...item, location: value}))}/>
                                <Field label="LinkedIn" value={profile.linkedin}
                                       onChange={value => updateProfile(item => ({...item, linkedin: value}))}/>
                                <Field label="GitHub" value={profile.github}
                                       onChange={value => updateProfile(item => ({...item, github: value}))}/>
                                <Field label="Portfolio" value={profile.portfolio}
                                       onChange={value => updateProfile(item => ({...item, portfolio: value}))}/>
                            </div>
                        </Section>

                        <Section title="Resume Basics" icon={<FileCode2 className="size-5 text-blue-500"/>}>
                            <div className="grid gap-3 md:grid-cols-3">
                                <Field label="Internal name" value={activeResume.internalName}
                                       onChange={value => updateResume(item => ({...item, internalName: value}))}/>
                                <label className="block">
                                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Language
                                    </span>
                                    <select
                                        value={activeResume.language}
                                        onChange={event => {
                                            const language = event.target.value as ResumeLanguage
                                            updateResume(item => ({
                                                ...item,
                                                language,
                                                meta: {
                                                    ...item.meta,
                                                    language: language === "PTBR" ? "pt-BR" : "en-US",
                                                },
                                            }))
                                            setPromptTemplate(getPromptTemplate(language))
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="PTBR">BR pt-BR</option>
                                        <option value="EN">US en-US</option>
                                    </select>
                                </label>
                                <Field label="Page size" value={activeResume.meta.page.size}
                                       onChange={value => updateResume(item => ({
                                           ...item,
                                           meta: {...item.meta, page: {...item.meta.page, size: value}},
                                       }))}/>
                            </div>
                            <div className="mt-3">
                                <TextareaField label="Summary" value={activeResume.summary}
                                               onChange={value => updateResume(item => ({...item, summary: value}))}/>
                            </div>
                        </Section>

                        <Section title="Contacts" icon={<UserRound className="size-5 text-blue-500"/>}>
                            <div className="grid gap-3 md:grid-cols-2">
                                {(Object.keys(activeResume.contacts) as Array<keyof ResumeDraft["contacts"]>).map(key => (
                                    <Field
                                        key={key}
                                        label={key}
                                        value={activeResume.contacts[key]}
                                        onChange={value => updateResume(item => ({
                                            ...item,
                                            contacts: {...item.contacts, [key]: value},
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section title="Skills" icon={<Sparkles className="size-5 text-blue-500"/>}>
                            <div className="grid gap-3 md:grid-cols-2">
                                {skillKeys.map(key => (
                                    <TextareaField
                                        key={key}
                                        label={skillLabels[key]}
                                        rows={3}
                                        value={listToText(activeResume.skills[key])}
                                        onChange={value => updateResume(item => ({
                                            ...item,
                                            skills: {...item.skills, [key]: normalizeList(value)},
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section
                            title="Experiences"
                            icon={<BriefcaseBusiness className="size-5 text-blue-500"/>}
                            action={<IconButton label="Add experience" onClick={addExperience}><Plus size={16}/></IconButton>}
                        >
                            <div className="grid gap-4">
                                {activeResume.experiences.map((experience, index) => (
                                    <ExperienceEditor
                                        key={experience.id}
                                        experience={experience}
                                        onChange={next => updateResume(item => ({
                                            ...item,
                                            experiences: updateAt(item.experiences, index, () => next),
                                        }))}
                                        onRemove={() => updateResume(item => ({
                                            ...item,
                                            experiences: removeAt(item.experiences, index),
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section
                            title="Projects"
                            icon={<FileCode2 className="size-5 text-blue-500"/>}
                            action={<IconButton label="Add project" onClick={addProject}><Plus size={16}/></IconButton>}
                        >
                            <div className="grid gap-4">
                                {activeResume.projects.length === 0 ? (
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        No projects in this seed.
                                    </p>
                                ) : activeResume.projects.map((project, index) => (
                                    <ProjectEditor
                                        key={project.id}
                                        project={project}
                                        onChange={next => updateResume(item => ({
                                            ...item,
                                            projects: updateAt(item.projects, index, () => next),
                                        }))}
                                        onRemove={() => updateResume(item => ({
                                            ...item,
                                            projects: removeAt(item.projects, index),
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section
                            title="Education"
                            icon={<BookOpen className="size-5 text-blue-500"/>}
                            action={<IconButton label="Add education" onClick={addEducation}><Plus size={16}/></IconButton>}
                        >
                            <div className="grid gap-4">
                                {activeResume.education.map((education, index) => (
                                    <EducationEditor
                                        key={education.id}
                                        education={education}
                                        onChange={next => updateResume(item => ({
                                            ...item,
                                            education: updateAt(item.education, index, () => next),
                                        }))}
                                        onRemove={() => updateResume(item => ({
                                            ...item,
                                            education: removeAt(item.education, index),
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section
                            title="Languages"
                            icon={<Languages className="size-5 text-blue-500"/>}
                            action={<IconButton label="Add language" onClick={addLanguage}><Plus size={16}/></IconButton>}
                        >
                            <div className="grid gap-3 md:grid-cols-2">
                                {activeResume.languages.map((language, index) => (
                                    <LanguageEditor
                                        key={language.id}
                                        language={language}
                                        onChange={next => updateResume(item => ({
                                            ...item,
                                            languages: updateAt(item.languages, index, () => next),
                                        }))}
                                        onRemove={() => updateResume(item => ({
                                            ...item,
                                            languages: removeAt(item.languages, index),
                                        }))}
                                    />
                                ))}
                            </div>
                        </Section>
                    </div>

                    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5 dark:border-slate-800 dark:bg-[#172033]">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-lg font-black">
                                <Sparkles className="size-5 text-blue-500"/>
                                Context Builder
                            </h2>
                            <span className="rounded-full border border-slate-300 px-2 py-1 text-xs font-black text-slate-500 dark:border-slate-700">
                                {status}
                            </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormat("latex")}
                                className={`rounded-lg border px-3 py-2 text-sm font-black transition ${format === "latex" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                            >
                                LaTeX
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat("json")}
                                className={`rounded-lg border px-3 py-2 text-sm font-black transition ${format === "json" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                            >
                                JSON
                            </button>
                        </div>

                        <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={includeAtsHiddenKeywords}
                                onChange={event => setIncludeAtsHiddenKeywords(event.target.checked)}
                                className="size-4"
                            />
                            Hidden ATS keywords
                        </label>

                        <div className="mt-4">
                            <TextareaField
                                label="Prompt template"
                                value={promptTemplate}
                                onChange={setPromptTemplate}
                                rows={8}
                            />
                        </div>

                        <div className="mt-4">
                            <TextareaField
                                label="Job description"
                                value={jobDescription}
                                onChange={setJobDescription}
                                rows={7}
                                placeholder="Paste the job description here..."
                            />
                        </div>

                        <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Resume export
                                </span>
                                <IconButton label="Copy resume export" onClick={() => handleCopy("resume", resumeExport)}>
                                    {copied === "resume" ? <Check size={16}/> : format === "json" ? <FileJson size={16}/> : <Copy size={16}/>}
                                </IconButton>
                            </div>
                            <textarea readOnly value={resumeExport} rows={9} className={`${textareaClass} font-mono text-xs`}/>
                        </div>

                        <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Final prompt
                                </span>
                                <IconButton label="Copy final prompt" onClick={() => handleCopy("prompt", finalPrompt)} tone="blue">
                                    {copied === "prompt" ? <Check size={16}/> : <Copy size={16}/>}
                                </IconButton>
                            </div>
                            <textarea readOnly value={finalPrompt} rows={11} className={`${textareaClass} font-mono text-xs`}/>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}

function ExperienceEditor({
                              experience,
                              onChange,
                              onRemove,
                          }: {
    experience: ResumeExperience
    onChange: (value: ResumeExperience) => void
    onRemove: () => void
}) {
    return (
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#101827]">
            <div className="mb-3 flex justify-end">
                <IconButton label="Remove experience" onClick={onRemove} tone="red">
                    <Trash2 size={16}/>
                </IconButton>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company" value={experience.company}
                       onChange={value => onChange({...experience, company: value})}/>
                <Field label="Role" value={experience.role}
                       onChange={value => onChange({...experience, role: value})}/>
                <Field label="Location" value={experience.location}
                       onChange={value => onChange({...experience, location: value})}/>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Start" value={experience.startDate}
                           onChange={value => onChange({...experience, startDate: value})}/>
                    <Field label="End" value={experience.endDate}
                           onChange={value => onChange({...experience, endDate: value})}/>
                </div>
                <TextareaField label="Highlights" rows={5} value={experience.highlights.join("\n")}
                               onChange={value => onChange({
                                   ...experience,
                                   highlights: value.split("\n"),
                               })}/>
                <TextareaField label="Stack" rows={5} value={listToText(experience.stack)}
                               onChange={value => onChange({...experience, stack: normalizeList(value)})}/>
            </div>
        </article>
    )
}

function ProjectEditor({
                           project,
                           onChange,
                           onRemove,
                       }: {
    project: ResumeProject
    onChange: (value: ResumeProject) => void
    onRemove: () => void
}) {
    return (
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#101827]">
            <div className="mb-3 flex justify-end">
                <IconButton label="Remove project" onClick={onRemove} tone="red">
                    <Trash2 size={16}/>
                </IconButton>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name" value={project.name} onChange={value => onChange({...project, name: value})}/>
                <Field label="Stack" value={listToText(project.stack)}
                       onChange={value => onChange({...project, stack: normalizeList(value)})}/>
                <Field label="GitHub" value={project.links.github}
                       onChange={value => onChange({...project, links: {...project.links, github: value}})}/>
                <Field label="Website" value={project.links.website}
                       onChange={value => onChange({...project, links: {...project.links, website: value}})}/>
            </div>
            <div className="mt-3">
                <TextareaField label="Description" value={project.description}
                               onChange={value => onChange({...project, description: value})}/>
            </div>
        </article>
    )
}

function EducationEditor({
                             education,
                             onChange,
                             onRemove,
                         }: {
    education: ResumeEducation
    onChange: (value: ResumeEducation) => void
    onRemove: () => void
}) {
    return (
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#101827]">
            <div className="mb-3 flex justify-end">
                <IconButton label="Remove education" onClick={onRemove} tone="red">
                    <Trash2 size={16}/>
                </IconButton>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Institution" value={education.institution}
                       onChange={value => onChange({...education, institution: value})}/>
                <Field label="Degree" value={education.degree}
                       onChange={value => onChange({...education, degree: value})}/>
                <Field label="Location" value={education.location}
                       onChange={value => onChange({...education, location: value})}/>
                <div className="grid grid-cols-3 gap-2">
                    <Field label="Start" value={education.startYear}
                           onChange={value => onChange({...education, startYear: value})}/>
                    <Field label="End" value={education.endYear}
                           onChange={value => onChange({...education, endYear: value})}/>
                    <Field label="Year" value={education.year}
                           onChange={value => onChange({...education, year: value})}/>
                </div>
            </div>
        </article>
    )
}

function LanguageEditor({
                            language,
                            onChange,
                            onRemove,
                        }: {
    language: ResumeLanguageItem
    onChange: (value: ResumeLanguageItem) => void
    onRemove: () => void
}) {
    return (
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#101827]">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_42px] gap-2">
                <Field label="Name" value={language.name}
                       onChange={value => onChange({...language, name: value})}/>
                <Field label="Level" value={language.level}
                       onChange={value => onChange({...language, level: value})}/>
                <div className="flex items-end">
                    <IconButton label="Remove language" onClick={onRemove} tone="red">
                        <Trash2 size={16}/>
                    </IconButton>
                </div>
            </div>
        </article>
    )
}
