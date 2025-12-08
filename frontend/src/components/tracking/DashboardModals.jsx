import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    DownloadCloud, Clock, AlertCircle,
    Building, X, Calendar as CalendarIcon, MapPin, Users, ExternalLink, AlignLeft,
    Terminal, FileJson, RefreshCcw, Upload, ArrowRight, TrendingUp, Filter, Play
} from 'lucide-react';
import { formatCustomDate } from '../../utils/dateUtils';

// --- MODAL 1: ENRICHMENT (Action) ---
export const BackfillModal = ({ onClose, onComplete }) => {
    const [timeRange, setTimeRange] = useState('past_month');
    const [hasStarted, setHasStarted] = useState(false); // ✨ NEW: Controls start

    const [progress, setProgress] = useState({
        current: 0, total: 0, job_title: 'Waiting to start...', company: '', eta_seconds: 0, success_count: 0, changes: []
    });
    const [logs, setLogs] = useState([]);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        // 🛑 Block execution until user clicks Start
        if (!hasStarted) return;

        // Reset UI state
        setProgress({
            current: 0, total: 0, job_title: 'Initializing...', company: '', eta_seconds: 0, success_count: 0, changes: []
        });
        setLogs([]);
        setIsFinished(false);

        const eventSource = new EventSource(`http://localhost:5000/pipeline/backfill-descriptions-stream?time_range=${timeRange}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            setLogs(prev => [{
                id: Date.now(),
                title: data.job_title,
                status: data.status,
                changes: data.changes || []
            }, ...prev].slice(0, 50));
        };

        eventSource.addEventListener('complete', (e) => {
            const data = e.data ? JSON.parse(e.data) : { message: 'Finished' };
            setProgress(prev => ({
                ...prev,
                job_title: data.message || 'Process Complete',
                company: ''
            }));
            setIsFinished(true);
            eventSource.close();
            if(onComplete) onComplete();
        });

        eventSource.addEventListener('error', (e) => {
            if (e.data) {
                const errData = JSON.parse(e.data);
                setLogs(prev => [{ id: Date.now(), title: `🚨 Error: ${errData.error}`, status: 'error', changes: [] }, ...prev]);
            }
            eventSource.close();
            setIsFinished(true);
        });

        return () => eventSource.close();
    }, [hasStarted]); // ⚡ Only run when hasStarted changes to true

    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : (isFinished ? 100 : 0);

    const formatTime = (seconds) => {
        if (!seconds && isFinished) return '0s';
        if (!seconds) return '...';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header with Filter */}
                <div className="p-6 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className={`text-blue-500 ${hasStarted && !isFinished ? 'animate-pulse' : ''}`} />
                            Enriching Job Data
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Updates applicants, descriptions & statuses.</p>
                    </div>

                    {/* Time Range Dropdown */}
                    <div className="relative">
                        <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            disabled={hasStarted} // 🔒 Disable while running
                            className="bg-gray-800 text-xs text-gray-300 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-gray-750 transition-colors"
                        >
                            <option value="past_24h">Past 24 Hours</option>
                            <option value="past_week">Past Week</option>
                            <option value="past_month">Past Month</option>
                            <option value="past_6_months">Past 6 Months</option>
                            <option value="all_time">All Time</option>
                        </select>
                    </div>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    {/* ✨ Start Screen vs Progress Screen */}
                    {!hasStarted ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                            <div className="p-4 bg-blue-500/10 rounded-full">
                                <TrendingUp size={48} className="text-blue-500" />
                            </div>
                            <h4 className="text-lg font-semibold text-white">Ready to Enrich</h4>
                            <p className="text-sm text-gray-400 max-w-xs">
                                Select a time range above and click Start. This will scan your saved jobs for updated applicant counts and statuses.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Progress Bar */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-300 font-mono">{progress.current} / {progress.total} Jobs</span>
                                    <span className="text-blue-400 font-bold">{percentage}%</span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                    <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300 ease-out" style={{ width: `${percentage}%` }} />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Clock size={14} /> Est. Time</div>
                                    <div className="text-xl font-bold text-white font-mono">{formatTime(progress.eta_seconds)}</div>
                                </div>
                                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><AlertCircle size={14} /> Updates Found</div>
                                    <div className="text-xl font-bold text-green-400 font-mono">{progress.success_count}</div>
                                </div>
                            </div>

                            {/* Active Job Card / Status Box */}
                            <div className={`border rounded-lg p-4 relative overflow-hidden transition-colors ${isFinished ? 'bg-gray-800/50 border-gray-700' : 'bg-blue-950/30 border-blue-900/50'}`}>
                                {!isFinished && <div className="absolute top-0 right-0 p-2 opacity-20"><RefreshCcw size={40} className="animate-spin text-blue-400"/></div>}
                                <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${isFinished ? 'text-gray-500' : 'text-blue-400'}`}>
                                    {isFinished ? 'Status' : 'Processing Now'}
                                </p>
                                <p className="text-white font-medium truncate pr-8">{progress.job_title}</p>
                                <p className="text-gray-400 text-sm truncate">{progress.company}</p>
                            </div>

                            {/* Live Logs with Diffs */}
                            <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-gray-800 max-h-48 overflow-y-auto">
                                {logs.length === 0 && isFinished && (
                                    <div className="text-center text-gray-500 text-xs py-4">No activity to report.</div>
                                )}
                                {logs.map(log => (
                                    <div key={log.id} className="text-xs border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={log.status === 'success' ? 'text-green-500' : 'text-gray-500'}>
                                                {log.status === 'success' ? '●' : '○'}
                                            </span>
                                            <span className="text-gray-300 font-medium truncate">{log.title}</span>
                                        </div>

                                        {log.changes && log.changes.length > 0 ? (
                                            <div className="pl-5 space-y-1">
                                                {log.changes.map((change, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5 text-gray-400 font-mono text-[10px]">
                                                        <span className="text-blue-300">{change.field}:</span>
                                                        <span className="line-through opacity-60">{change.old}</span>
                                                        <ArrowRight size={10} className="text-gray-600" />
                                                        <span className="text-green-400 font-bold">{change.new}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="pl-5 text-[10px] text-gray-600 italic">No changes detected</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-end gap-3">
                    {!hasStarted ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button
                                onClick={() => setHasStarted(true)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
                            >
                                <Play size={16} fill="currentColor" /> Start Enrichment
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            disabled={!isFinished}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isFinished ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                        >
                            {isFinished ? 'Close' : 'Processing...'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ScraperSettings = ({ onClose, onSaveSuccess }) => {
    const [statusMessage, setStatusMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setStatusMessage('Reading file...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            try {
                const liAtMatch = content.match(/li_at=([^;"]+)/);
                const jsessionMatch = content.match(/JSESSIONID=?[\\"]*ajax:([0-9]+)/);
                if (liAtMatch && jsessionMatch) {
                    await axios.put('http://localhost:5000/services/cookies', {
                        identifier: 'LinkedIn_Saved_Jobs_Scraper',
                        cookies: `li_at=${liAtMatch[1]}; JSESSIONID="ajax:${jsessionMatch[1]}"`,
                        csrfToken: `ajax:${jsessionMatch[1]}`
                    });
                    setStatusMessage('✅ Credentials Updated!');
                    onSaveSuccess();
                    setTimeout(onClose, 1500);
                } else { setStatusMessage('❌ Error: Could not find li_at or JSESSIONID.'); }
            } catch (err) { setStatusMessage('❌ Parsing Error: ' + err.message); }
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-6">
                <div><h3 className="text-xl font-bold text-white flex items-center gap-2"><Terminal size={20} className="text-blue-400" /> Update LinkedIn Credentials</h3></div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 bg-gray-900/50 flex flex-col items-center">
                <FileJson size={48} className="text-gray-500 mb-4" />
                <input type="file" accept=".har,.json" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"><Upload size={18} /> Upload .HAR File</button>
                {statusMessage && <div className="mt-4 text-sm text-gray-300">{statusMessage}</div>}
            </div>
        </div>
    );
};

export const JobDetailsPanel = ({ job, onClose }) => {
    if (!job) return null;
    const isEnriched = job.description_full && job.description_full !== "No description provided";
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-gray-900 border-l border-gray-700 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="p-6 border-b border-gray-800 bg-gray-900">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white leading-tight mb-1">{job.title}</h2>
                            <div className="flex items-center gap-2 text-blue-400 font-medium"><Building size={16} />{job.company}</div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><X size={24} /></button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                        <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
                            <CalendarIcon size={14} />
                            {formatCustomDate(job.appliedAt)}
                        </div>
                        {job.location && <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700"><MapPin size={14} /> {job.location}</div>}
                        <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-blue-900/20 text-blue-300 px-3 py-1.5 rounded-full border border-blue-800 hover:bg-blue-900/40"><ExternalLink size={14} /> View on {job.source}</a>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="flex items-center gap-2 mb-4 text-sm font-bold text-gray-400 uppercase tracking-wider"><AlignLeft size={16} /> Job Description</div>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5" dangerouslySetInnerHTML={{ __html: job.description_full || '<p class="text-gray-500 italic">No description.</p>' }} />
                </div>
                <div className="p-4 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-500 flex justify-between">
                    <span>URN: {job.urn}</span>
                    <span className={isEnriched ? "text-green-500" : "text-amber-500"}>{isEnriched ? "● Description Backfilled" : "● Description Missing"}</span>
                </div>
            </div>
        </div>
    );
};