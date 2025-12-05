import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    DownloadCloud, Clock, AlertCircle,
    Building, X, Calendar as CalendarIcon, MapPin, Users, ExternalLink, AlignLeft,
    Terminal, FileJson, RefreshCcw, Upload
} from 'lucide-react';

// --- MODAL 1: BACKFILL (Action) ---
export const BackfillModal = ({ onClose, onComplete }) => {
    const [progress, setProgress] = useState({
        current: 0, total: 0, job_title: 'Initializing...', company: '', eta_seconds: 0, success_count: 0
    });
    const [logs, setLogs] = useState([]);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:5000/pipeline/backfill-descriptions-stream');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);
            setLogs(prev => [{ id: Date.now(), text: `${data.status === 'success' ? '✅' : '❌'} ${data.job_title}`, type: data.status }, ...prev].slice(0, 5));
        };
        eventSource.addEventListener('complete', () => {
            setIsFinished(true);
            eventSource.close();
            if(onComplete) onComplete();
        });
        eventSource.addEventListener('error', (e) => {
            if (e.data) {
                const errData = JSON.parse(e.data);
                setLogs(prev => [{ id: Date.now(), text: `🚨 Error: ${errData.error}`, type: 'error' }, ...prev]);
            }
        });
        return () => eventSource.close();
    }, []);

    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const formatTime = (seconds) => {
        if (!seconds) return 'Calculating...';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700 bg-gray-900/50">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <DownloadCloud className="text-blue-400 animate-pulse" /> Backfilling Descriptions
                    </h3>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-white font-mono">{progress.current} / {progress.total} Jobs</span>
                            <span className="text-blue-400 font-bold">{percentage}%</span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${percentage}%` }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Clock size={14} /> Est. Time</div>
                            <div className="text-lg font-bold text-white font-mono">{formatTime(progress.eta_seconds)}</div>
                        </div>
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><AlertCircle size={14} /> Success Rate</div>
                            <div className="text-lg font-bold text-green-400 font-mono">{progress.success_count} found</div>
                        </div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4">
                        <p className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Processing Now</p>
                        <p className="text-white font-medium truncate">{progress.job_title}</p>
                        <p className="text-gray-400 text-sm truncate">{progress.company}</p>
                    </div>
                    <div className="space-y-1.5">
                        {logs.map(log => <div key={log.id} className={`text-xs ${log.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{log.text}</div>)}
                    </div>
                </div>
                <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} disabled={!isFinished} className={`px-6 py-2 rounded-lg font-medium ${isFinished ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-500'}`}>{isFinished ? 'Close' : 'Processing...'}</button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL 2: SETTINGS (Action) ---
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

// --- MODAL 3: JOB DETAILS (View) ---
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
                        <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700"><CalendarIcon size={14} /> {new Date(job.appliedAt).toLocaleDateString()}</div>
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