// frontend/src/components/match-find/MatchPdfGeneration.jsx
import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { getColorFromScore } from './MatchLogic.jsx';

/* ------------------------------------------------------------ */
/* ------------------------- helpers -------------------------- */
/* ------------------------------------------------------------ */

/**
 * Very light markdown parser → array of {type, text, level}
 *  type: 'h' | 'li' | 'p'
 *  level: heading level (1‑6)  OR null
 */
const mdToBlocks = (md = '') => {
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];

    lines.forEach((raw) => {
        const line = raw.trimEnd();

        // empty ‑‑> paragraph break
        if (!line) {
            blocks.push({ type: 'br' });
            return;
        }

        // heading
        const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (hMatch) {
            blocks.push({
                type: 'h',
                level: hMatch[1].length,
                text: hMatch[2].replace(/[^\u0000-\u00FF]/g, ''),
            });
            return;
        }

        // bullet
        const liMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (liMatch) {
            blocks.push({
                type: 'li',
                text: liMatch[1].replace(/[^\u0000-\u00FF]/g, ''),
            });
            return;
        }

        // links [txt](url) → txt
        const cleaned = line
            .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
            .replace(/[*_~`]/g, '')
            .replace(/[^\u0000-\u00FF]/g, '');

        blocks.push({ type: 'p', text: cleaned });
    });

    return blocks;
};

/* spinner ---------------------------------------------------- */
const Spinner = ({ className = 'h-5 w-5 text-white' }) => (
    <svg
        className={`animate-spin ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
    >
        <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
        />
        <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
    </svg>
);

/* ------------------------------------------------------------ */
/* ------------------------- component ------------------------ */
/* ------------------------------------------------------------ */

const MatchPdfGeneration = ({
                                fullResumeMarkdown,
                                matchScore,
                                matchScoreError,
                                isCalculatingScore,
                                onCalculateScore,
                                onClosePreview,
                            }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    /* ------------- PDF generation --------------------------- */
    const handleDownloadPdf = () => {
        if (!fullResumeMarkdown) return;
        setIsGeneratingPdf(true);

        try {
            const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
            const marginX = 20;
            const marginY = 20;
            const pageH = pdf.internal.pageSize.getHeight();

            let y = marginY;

            /* helper to break page */
            const newLine = (delta) => {
                y += delta;
                if (y > pageH - marginY) {
                    pdf.addPage();
                    y = marginY;
                }
            };

            /* render blocks */
            mdToBlocks(fullResumeMarkdown).forEach((b) => {
                switch (b.type) {
                    case 'h': {
                        const fontSize = b.level === 1 ? 14 : 12;
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(fontSize);
                        const lines = pdf.splitTextToSize(
                            b.text,
                            170 /* width */,
                        );
                        lines.forEach((ln) => {
                            pdf.text(ln, marginX, y);
                            newLine(fontSize * 0.4 + 5);
                        });
                        // after heading add extra whitespace
                        newLine(2);
                        break;
                    }

                    case 'li': {
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(10);
                        const bullet = '– '; // ATS‑safe bullet
                        const lines = pdf.splitTextToSize(
                            bullet + b.text,
                            170,
                        );
                        lines.forEach((ln, idx) => {
                            const indent =
                                idx === 0 ? marginX : marginX + 5;
                            pdf.text(ln, indent, y);
                            newLine(6);
                        });
                        break;
                    }

                    case 'p': {
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(10);
                        const lines = pdf.splitTextToSize(b.text, 170);
                        lines.forEach((ln) => {
                            pdf.text(ln, marginX, y);
                            newLine(6);
                        });
                        newLine(2);
                        break;
                    }

                    case 'br':
                        newLine(6);
                        break;

                    default:
                        break;
                }
            });

            pdf.save('resume-content.pdf');
        } catch (err) {
            console.error('Error generating PDF:', err);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    /* -------------------------- UI -------------------------- */
    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-6 rounded-xl shadow-lg w-full flex flex-col border dark:border-gray-700">
                {/* header */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Full Resume Markdown Preview
                    </h2>

                    <div className="flex items-center gap-3">
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
                                'Calculate Score'
                            )}
                        </button>

                        <button
                            onClick={handleDownloadPdf}
                            disabled={
                                isCalculatingScore ||
                                isGeneratingPdf ||
                                !fullResumeMarkdown
                            }
                            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs rounded-md disabled:cursor-wait disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isGeneratingPdf ? (
                                <>
                                    <Spinner className="w-4 h-4" />
                                    Generating…
                                </>
                            ) : (
                                'Download PDF'
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
                <div className="w-full flex justify-center">
                    <div className="w-[85%]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                Match Score
                            </div>
                            <div className="text-right">
                                {matchScoreError ? (
                                    <div className="text-xs text-red-500 dark:text-red-400">
                                        ⚠ {matchScoreError}
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="font-bold text-lg"
                                            style={{
                                                color: getColorFromScore(
                                                    matchScore ?? 0,
                                                ),
                                            }}
                                        >
                                            {matchScore !== null
                                                ? `${matchScore}%`
                                                : '…'}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Match
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 rounded-full transition-all duration-200"
                                style={{
                                    width:
                                        matchScore !== null
                                            ? `${matchScore}%`
                                            : '0%',
                                    backgroundColor: matchScoreError
                                        ? 'transparent'
                                        : getColorFromScore(matchScore ?? 0),
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* raw markdown textarea */}
                <textarea
                    readOnly
                    value={fullResumeMarkdown}
                    className="mt-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm w-full rounded-md p-4 resize-none focus:ring-2 focus:ring-indigo-500"
                    style={{ height: '60vh' }}
                />
            </div>
        </div>
    );
};

export default MatchPdfGeneration;
