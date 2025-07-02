import React, { useState, useEffect } from 'react';
import { Check, Clipboard } from 'lucide-react';

export const ResultsView = ({ data }) => {
    const [textareaContent, setTextareaContent] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    // This effect runs only when the `data` prop from the parent changes,
    // populating the textarea with the newly fetched data.
    useEffect(() => {
        setTextareaContent(JSON.stringify(data, null, 2));
    }, [data]);

    const handleCopy = () => {
        navigator.clipboard.writeText(textareaContent).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error("Failed to copy text: ", err);
        });
    };

    return (
        <div className="mt-8">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-300">Fetched Data</h2>
                <button
                    onClick={handleCopy}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                    {isCopied ? <Check size={16} className="mr-2 text-green-500"/> : <Clipboard size={16} className="mr-2"/>}
                    {isCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
            </div>
            <textarea
                value={textareaContent}
                onChange={(e) => setTextareaContent(e.target.value)}
                className="w-full min-h-[400px] mt-4 p-4 bg-white dark:bg-[#2d2d3d] border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
        </div>
    );
};