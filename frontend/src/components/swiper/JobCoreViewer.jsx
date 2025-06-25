import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, X, Heart, ExternalLink, Building, Code, Users, Award, ArrowLeft, ArrowRight, Home } from 'lucide-react';

import jobsData from './job_details_augmented.json'
import {JobListView} from "./JobListView.jsx";
import {SwiperView} from "./JobSwiperView.jsx";




export default function JobCoreViewer() {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'swiper'
    const [selectedJobIndex, setSelectedJobIndex] = useState(0);

    const handleViewDetails = (index) => {
        setSelectedJobIndex(index);
        setViewMode('swiper');
    };

    const handleBackToList = () => {
        setViewMode('list');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
            <AnimatePresence mode="wait">
                <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full flex items-center justify-center"
                >
                    {viewMode === 'list' ? (
                        <JobListView jobs={jobsData} onViewDetails={handleViewDetails} />
                    ) : (
                        <SwiperView jobs={jobsData} initialIndex={selectedJobIndex} onBackToList={handleBackToList} />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

// --- END FILE: App.jsx ---
