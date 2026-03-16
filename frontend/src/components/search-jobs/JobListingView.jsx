import React, { useState, useCallback, useRef, useEffect } from "react";
import JobListingSidebar from "./JobListingSidebar";
import JobListingJobDetails from "./JobListingJobDetails";

const JobListingView = ({
  jobsState,
  filtersState,
  filterOptions,
  actions,
  fetchModalState,
  fetchModalActions,
}) => {
  const { selectedJob } = jobsState;

  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(37);
  const containerRef = useRef(null);

  const MIN_WIDTH = 28;
  const MAX_WIDTH = 65;

  const handleMouseDown = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidthPx = event.clientX - containerRect.left;
      const newWidthPercent = (newWidthPx / containerRect.width) * 100;
      const clampedWidth = Math.max(
        MIN_WIDTH,
        Math.min(newWidthPercent, MAX_WIDTH),
      );

      setLeftPanelWidth(clampedWidth);
    },
    [isDragging],
  );

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="h-screen bg-[#081120] font-sans text-slate-100">
      <div
        ref={containerRef}
        className="flex h-full"
        style={{ userSelect: isDragging ? "none" : "auto" }}
      >
        <JobListingSidebar
          leftPanelWidth={leftPanelWidth}
          jobsState={jobsState}
          filtersState={filtersState}
          filterOptions={filterOptions}
          actions={actions}
          fetchModalState={fetchModalState}
          fetchModalActions={fetchModalActions}
        />

        <div
          className="w-2 cursor-col-resize bg-slate-800 transition hover:bg-sky-500"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 bg-[#0d1728]">
          <JobListingJobDetails job={selectedJob} />
        </main>
      </div>
    </div>
  );
};

export default JobListingView;
