import React, { useState } from 'react';

export const CopyableCodeBlock = ({ label, text, className = '' }) => {
    const [copied, setCopied] = useState(false);

    // Debug log to prove the new code loaded
    console.log('Rendering CopyableCodeBlock for:', label);

    const handleCopy = (e) => {
        e.stopPropagation();
        if (!text) return;

        // Simple fallback included directly
        const doCopy = () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(doCopy);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            doCopy();
        }
    };

    if (!text) return null;

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">
                    {label}
                </span>
            )}

            <div className="relative flex items-center">
                {/* The Input Field */}
                <div className="w-full pl-3 pr-12 py-2.5 bg-gray-900 border border-gray-700 rounded-md font-mono text-sm text-gray-300 overflow-x-auto whitespace-nowrap">
                    {text}
                </div>

                {/* The Button - Absolute positioned, Hardcoded SVG, Distinct Background */}
                <button
                    onClick={handleCopy}
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300 hover:text-white transition-colors z-10"
                    title="Copy"
                >
                    {copied ? (
                        // Hardcoded Checkmark
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ) : (
                        // Hardcoded Clipboard
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};