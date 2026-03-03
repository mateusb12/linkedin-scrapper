import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const MonthPicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [y] = value.split("-");
      setViewYear(parseInt(y, 10));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMonthSelect = (monthIndex) => {
    const formattedMonth = String(monthIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${formattedMonth}`);
    setIsOpen(false);
  };

  const currentMonthIndex = value ? parseInt(value.split("-")[1], 10) - 1 : -1;
  const currentYearSelected = value ? parseInt(value.split("-")[0], 10) : -1;

  const displayValue = value
    ? `${MONTHS[parseInt(value.split("-")[1], 10) - 1]} / ${value.split("-")[0]}`
    : "Selecione...";

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-mono rounded-lg border border-slate-600 hover:border-purple-500 transition-colors w-32 justify-between ${
          isOpen ? "border-purple-500 ring-1 ring-purple-500/50" : ""
        }`}
      >
        <span className="truncate">{displayValue}</span>
        <CalendarDays size={14} className="text-purple-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-2 py-2 bg-slate-900 border-b border-slate-700">
            <button
              onClick={() => setViewYear(viewYear - 1)}
              className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-bold text-slate-200 text-sm tracking-wider">
              {viewYear}
            </span>
            <button
              onClick={() => setViewYear(viewYear + 1)}
              className="p-1 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="p-3 grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => {
              const isSelected =
                currentYearSelected === viewYear && currentMonthIndex === index;
              const isCurrentMonth =
                new Date().getFullYear() === viewYear &&
                new Date().getMonth() === index;

              return (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(index)}
                  className={`
                    text-xs font-bold py-2 rounded-md transition-all
                    ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50 scale-105"
                        : "bg-slate-700/30 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }
                    ${isCurrentMonth && !isSelected ? "border border-slate-500 text-slate-300" : "border border-transparent"}
                  `}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthPicker;
