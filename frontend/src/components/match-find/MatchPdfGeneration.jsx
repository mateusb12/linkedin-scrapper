import React, { useState, useEffect } from 'react'; // --- ADDED: useEffect ---
import { XCircle, Lock, Unlock } from 'lucide-react'; // --- ADDED: Lock, Unlock icons ---
import jsPDF from 'jspdf';
import { getColorFromScore } from './MatchLogic.jsx';
import usa from "../../assets/skills_icons/usa.svg";
import brazil from "../../assets/skills_icons/brazil.svg";

const contactLabels = {
    en: { phone: "Phone Number", email: "Email", location: "Location" },
    pt: { phone: "Telefone", email: "Email", location: "Localização" }
};

const mdToBlocks = (md = '') => {
    // ... (mdToBlocks function remains unchanged)
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];

    lines.forEach((raw, idx) => {
        const line = raw.trimEnd();
        if (!line) {
            blocks.push({ type: 'br' });
            return;
        }

        if (idx === 1 && line.includes('|')) {
            const parts = line.split('|').map(s => s.trim());
            parts.forEach(part => {
                const linkMatch = part.match(/^\[([^\]]+)]\(([^\)]+)\)$/);
                if (linkMatch) {
                    blocks.push({ type: 'li-link', label: linkMatch[1], url: linkMatch[2] });
                } else if (part.includes('@')) {
                    blocks.push({ type: 'li-contact', contactType: 'email', value: part });
                } else if (part.match(/\+?\d/)) { // Simple check for a digit, likely a phone number
                    blocks.push({ type: 'li-contact', contactType: 'phone', value: part });
                } else if (part) { // If it's not empty, assume it's the location
                    blocks.push({ type: 'li-contact', contactType: 'location', value: part });
                }
            });
            return; // End processing for this line
        }

        const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (hMatch) {
            blocks.push({
                type: 'h',
                level: hMatch[1].length,
                text: hMatch[2],
            });
            return;
        }

        const liMatch = line.match(/^\s*[-*\u2013]\s+(.*)$/);
        if (liMatch) {
            blocks.push({
                type: 'li',
                text: liMatch[1],
            });
            return;
        }

        if (line.match(/^(---|___|\*\*\*)$/)) {
            blocks.push({ type: 'br' });
            return;
        }

        blocks.push({ type: 'p', text: line });
    });

    return blocks;
};

const Spinner = ({ className = 'h-5 w-5 text-white' }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
);

const MatchPdfGeneration = ({
                                fullResumeMarkdown,
                                matchScore,
                                matchScoreError,
                                isCalculatingScore,
                                onCalculateScore,
                                onClosePreview,
                                resumeLanguage,
                                resumeName,
                                jobTitle
                            }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    // --- START: ADDED state and effect for locking/unlocking ---
    const [isLocked, setIsLocked] = useState(true);
    const [editedMarkdown, setEditedMarkdown] = useState(fullResumeMarkdown);

    // This effect synchronizes the local state with the prop when the component
    // is in a "locked" state. When unlocked, it allows the local state to be independent.
    // If the user re-locks, it reverts any manual changes.
    useEffect(() => {
        if (isLocked) {
            setEditedMarkdown(fullResumeMarkdown);
        }
    }, [fullResumeMarkdown, isLocked]);

    const handleToggleLock = () => {
        setIsLocked(prev => !prev);
    };
    // --- END: ADDED state and effect ---

    const SPACING = {
        line: 5,
        bullet: 5,
        br: 3,
        h1Line: 6,
        h2Line: 5,
        afterHeading: 1,
    };

    const handleDownloadPdf = () => {
        // --- MODIFIED: Use the editable state for PDF generation ---
        if (!editedMarkdown) return;
        setIsGeneratingPdf(true);

        try {
            const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
            const marginX = 20;
            const marginY = 20;
            const pageH = pdf.internal.pageSize.getHeight();
            let y = marginY;

            const newLine = (delta) => {
                y += delta;
                if (y > pageH - marginY) {
                    pdf.addPage();
                    y = marginY;
                }
            };

            // --- MODIFIED: Use the editable 'editedMarkdown' state ---
            const blocks = mdToBlocks(editedMarkdown);

            // ... (rest of the handleDownloadPdf function is the same)
            for (const b of blocks) {
                if (!b || !b.type) continue;

                switch (b.type) {
                    case 'h': {
                        if (y > marginY + 5) newLine(3);
                        const isH1 = b.level === 1;
                        const fontSize = isH1 ? 14 : 12;
                        const lineHeight = isH1 ? SPACING.h1Line : SPACING.h2Line;
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(fontSize);
                        const cleanedText = b.text.replace(/[^\u0000-\u00FF]/g, '').trim();
                        const lines = pdf.splitTextToSize(cleanedText.replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1'), 170);
                        for (const [index, ln] of lines.entries()) {
                            pdf.text(ln, marginX, y);
                            newLine(index === lines.length - 1 ? lineHeight + SPACING.afterHeading : lineHeight);
                        }
                        break;
                    }
                    case 'li-link': {
                        pdf.setFontSize(10);
                        const bullet = '– ';
                        const separator = ' - ';
                        const prettify = (lbl) => {
                            if (/^linkedin$/i.test(lbl)) return 'LinkedIn';
                            if (/^github$/i.test(lbl)) return 'GitHub';
                            return lbl;
                        };
                        const displayLabel = prettify(b.label);
                        const boldText = bullet + displayLabel;
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(boldText, marginX, y);
                        const urlX = marginX + pdf.getTextWidth(boldText);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(separator + b.url, urlX, y);
                        newLine(SPACING.bullet);
                        break;
                    }
                    case 'li-contact': {
                        pdf.setFontSize(10);
                        const bullet = '– ';
                        const separator = ': ';

                        const labels = contactLabels[resumeLanguage] || contactLabels.en;
                        const labelText = labels[b.contactType];

                        const boldPart = bullet + labelText;
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(boldPart, marginX, y);

                        const labelWidth = pdf.getTextWidth(boldPart);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(separator + b.value, marginX + labelWidth, y);

                        newLine(SPACING.bullet);
                        break;
                    }
                    case 'li': {
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(10);
                        const bullet = '– ';
                        const cleanedText = b.text.replace(/[^\u0000-\u00FF]/g, '').trim();
                        const lines = pdf.splitTextToSize(cleanedText, 165);
                        for (const [idx, ln] of lines.entries()) {
                            pdf.text(idx === 0 ? bullet + ln : ln, marginX + (idx === 0 ? 0 : 3), y);
                            newLine(SPACING.bullet);
                        }
                        break;
                    }
                    case 'p': {
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(10);
                        const cleanedText = b.text.replace(/[^\u0000-\u00FF]/g, '').trim();
                        const final_text = cleanedText.replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1: $2').replace(/[*_~`]/g, '');
                        const lines = pdf.splitTextToSize(final_text, 170);
                        for (const ln of lines) {
                            pdf.text(ln, marginX, y);
                            newLine(SPACING.line);
                        }
                        break;
                    }
                    case 'br':
                        newLine(SPACING.br);
                        break;
                    default:
                        break;
                }
            }

            try {
                const safeJob = (jobTitle || 'job').replace(/[^a-z0-9]/gi, '_');
                const fileName = `${resumeName || 'resume'}-${safeJob}.pdf`;
                pdf.save(fileName);
            } catch (err) {
                console.error('❌ Error saving PDF file:', err);
            }
        } catch (err) {
            console.error('Error generating PDF:', err);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-6 rounded-xl shadow-lg w-full flex flex-col border dark:border-gray-700">
                {/* header */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                    <div className="mb-2">
                        <h2 className="text-xl font-bold text-white">Full Resume Markdown Preview</h2>
                        <div className="flex items-center gap-2 mt-1 text-xl text-gray-400 italic">
                            <img
                                src={resumeLanguage === 'pt' ? brazil : usa}
                                alt="Flag"
                                className="w-7 h-7 rounded-full"
                            />
                            <span>{resumeName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* --- START: ADDED Lock/Unlock Button --- */}
                        <button
                            onClick={handleToggleLock}
                            className={`px-4 py-1.5 font-semibold text-xs rounded-md transition-all flex items-center gap-2 ${
                                isLocked
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                            }`}
                        >
                            {isLocked ? (
                                <>
                                    <Unlock size={14} /> Unlock to Edit
                                </>
                            ) : (
                                <>
                                    <Lock size={14} /> Lock (Discard Edits)
                                </>
                            )}
                        </button>
                        {/* --- END: ADDED Lock/Unlock Button --- */}
                        <button
                            onClick={onCalculateScore}
                            disabled={isCalculatingScore || isGeneratingPdf}
                            className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-xs rounded-md disabled:cursor-wait disabled:opacity-50 transition-all"
                        >
                            {isCalculatingScore ? (
                                <div className="flex items-center gap-2">
                                    <Spinner className="w-4 h-4 text-black" />
                                    Calculating…
                                </div>
                            ) : (
                                'Calculate Score'
                            )}
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            // --- MODIFIED: check editedMarkdown for disabling button ---
                            disabled={isCalculatingScore || isGeneratingPdf || !editedMarkdown}
                            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs rounded-md disabled:cursor-wait disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isGeneratingPdf ? (
                                <>
                                    <Spinner className="w-4 h-4" />
                                    Generating…
                                </>
                            ) : (
                                'Download PDF'
                            )}
                        </button>
                        <button
                            onClick={onClosePreview}
                            className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2 rounded-full transition-colors"
                        >
                            <XCircle size={24} />
                        </button>
                    </div>
                </div>

                {/* match score */}
                {/* ... (match score section remains unchanged) ... */}
                <div className="w-full flex justify-center">
                    <div className="w-[85%]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Match Score</div>
                            <div className="text-right">
                                {matchScoreError ? (
                                    <div className="text-xs text-red-500 dark:text-red-400">⚠ {matchScoreError}</div>
                                ) : (
                                    <>
                                        <div
                                            className="font-bold text-lg"
                                            style={{ color: getColorFromScore(matchScore ?? 0) }}
                                        >
                                            {matchScore !== null ? `${matchScore}%` : '…'}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Match</div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 rounded-full transition-all duration-200"
                                style={{
                                    width: matchScore !== null ? `${matchScore}%` : '0%',
                                    backgroundColor: matchScoreError ? 'transparent' : getColorFromScore(matchScore ?? 0),
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* --- START: MODIFIED raw markdown textarea --- */}
                <textarea
                    readOnly={isLocked}
                    value={editedMarkdown}
                    onChange={(e) => setEditedMarkdown(e.target.value)}
                    className={`mt-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm w-full rounded-md p-4 resize-none transition-all ${
                        isLocked
                            ? 'focus:ring-2 focus:ring-indigo-500'
                            : 'focus:ring-2 focus:ring-green-500 ring-2 ring-green-500'
                    }`}
                    style={{ height: '60vh' }}
                />
                {/* --- END: MODIFIED raw markdown textarea --- */}
            </div>
        </div>
    );
};

export default MatchPdfGeneration;