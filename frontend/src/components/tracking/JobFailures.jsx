import React, { useState, useMemo } from 'react';
import { Mail, AlertCircle, ChevronRight, ChevronLeft, Search } from 'lucide-react';

// Reusing your Pagination Logic
const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    const getPageNumbers = () => {
        const pages = [];
        pages.push(1);
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    };

    return (
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 bg-gray-800">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white transition-colors"
            >
                <ChevronLeft size={20} />
            </button>
            {getPageNumbers().map((page, idx) => (
                <button
                    key={idx}
                    onClick={() => typeof page === 'number' ? onPageChange(page) : null}
                    disabled={typeof page !== 'number'}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        page === currentPage
                            ? 'bg-red-600 text-white shadow-md'
                            : typeof page === 'number'
                                ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
                                : 'text-gray-500 cursor-default'
                    }`}
                >
                    {page}
                </button>
            ))}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white transition-colors"
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );
};

const JobFailures = ({ emails, onSelectEmail, pagination }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEmails = useMemo(() => {
        if (!emails) return [];
        return emails.filter(e =>
            e.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.sender.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [emails, searchTerm]);

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-gray-800 to-red-900/10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                        <AlertCircle className="text-red-500" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Rejection Inbox</h3>
                        <p className="text-xs text-gray-400">Emails tagged "Job fails"</p>
                    </div>
                    {pagination && (
                        <span className="ml-2 text-xs font-mono text-red-300 bg-red-900/30 px-2 py-1 rounded border border-red-800/50">
                            Count: {pagination.total}
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Search rejections..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-500">
                        <Search size={14} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Sender</th>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Snippet</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                    {filteredEmails.length > 0 ? filteredEmails.map((email) => (
                        <tr
                            key={email.id}
                            onClick={() => onSelectEmail(email)}
                            className="group hover:bg-red-900/10 transition-colors cursor-pointer"
                        >
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-200">{email.sender}</div>
                                <div className="text-xs text-gray-500">{email.sender_email}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-300 font-medium group-hover:text-red-400 transition-colors">
                                {email.subject}
                            </td>
                            <td className="px-6 py-4 text-gray-400 text-sm whitespace-nowrap">
                                {new Date(email.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                <span className="text-xs text-gray-600 block">
                                    {new Date(email.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="max-w-xs text-xs text-gray-500 truncate">
                                    {email.snippet}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-700">
                                    <ChevronRight size={16} />
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="5" className="p-8 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-2">
                                    <Mail size={32} className="opacity-20" />
                                    <span>No rejection emails found. Good news?</span>
                                </div>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <PaginationControls
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.onPageChange}
                />
            )}
        </div>
    );
};

export default JobFailures;