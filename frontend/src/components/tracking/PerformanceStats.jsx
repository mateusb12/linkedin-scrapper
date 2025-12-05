import React from 'react';
import { Bar } from 'react-chartjs-2';
import targetIcon from '../../assets/ui_icons/target.png';
import fireIcon from '../../assets/ui_icons/fire.png';
import calendarIcon from '../../assets/ui_icons/calendar.png';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components locally
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const GOAL_PER_DAY = 10;
const themeColors = { textSecondary: '#9ca3af', success: '#22c55e', warning: '#f59e0b', danger: '#ef4444' };

const StatCard = ({ title, value, suffix, subtext, iconSrc, colorClass }) => {
    const pillClass = colorClass.replace('text-', 'bg-').replace('400', '400/10') + ' ' + colorClass;

    return (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-lg flex items-center gap-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-gray-600">
            <div className="w-16 h-16 flex-shrink-0 drop-shadow-md">
                <img src={iconSrc} alt={title} className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
                <div className="flex items-baseline mb-1.5">
                    <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
                    {suffix && <span className="text-sm font-medium text-gray-500 ml-1.5">{suffix}</span>}
                </div>
                {subtext && (
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${pillClass}`}>
                        {subtext}
                    </div>
                )}
            </div>
        </div>
    );
};

const PerformanceStats = ({ stats }) => {
    // Motivation Logic
    const getMotivation = () => {
        const remaining = GOAL_PER_DAY - stats.todayCount;
        if (remaining <= 0) return "Goal Crushed!";
        if (remaining <= 3) return "Almost There";
        return "Keep Pushing";
    };

    // Chart Configuration
    const chartData = {
        labels: stats.labels,
        datasets: [
            {
                type: 'line',
                label: 'Goal',
                data: stats.labels.map(() => GOAL_PER_DAY),
                borderColor: themeColors.textSecondary,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 0
            },
            {
                type: 'bar',
                label: 'Applications',
                data: stats.data,
                backgroundColor: stats.data.map(val =>
                    val >= GOAL_PER_DAY ? themeColors.success :
                        val >= (GOAL_PER_DAY / 2) ? themeColors.warning : themeColors.danger
                ),
                borderRadius: 6,
                order: 1
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, labels: { color: themeColors.textSecondary } },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (ctx) => {
                        if (ctx.dataset.type === 'line') return `Goal: ${ctx.raw}`;
                        return `Applied: ${ctx.raw}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(75, 85, 99, 0.2)' },
                ticks: { color: themeColors.textSecondary }
            },
            x: {
                grid: { display: false },
                ticks: { color: themeColors.textSecondary }
            }
        }
    };

    return (
        <>
            {/* 1. Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-10 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatCard
                    title="Today's Progress"
                    value={stats.todayCount}
                    suffix={`/ ${GOAL_PER_DAY}`}
                    subtext={getMotivation()}
                    iconSrc={targetIcon}
                    colorClass={stats.todayCount >= GOAL_PER_DAY ? "text-green-400" : "text-amber-400"}
                />
                <StatCard
                    title="Current Streak"
                    value={stats.streak}
                    suffix={stats.streak === 1 ? "Day" : "Days"}
                    subtext="Weekends Excluded"
                    iconSrc={fireIcon}
                    colorClass="text-blue-400"
                />
                <StatCard
                    title="Weekly Total"
                    value={stats.data.reduce((a, b) => a + b, 0)}
                    subtext="Last 7 Days"
                    iconSrc={calendarIcon}
                    colorClass="text-purple-400"
                />
            </div>

            {/* 2. Daily Performance Chart */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Daily Performance</h3>
                    <span className="text-xs text-gray-400 px-3 py-1 bg-gray-900 rounded-full border border-gray-700">
                        Goal: {GOAL_PER_DAY}/day
                    </span>
                </div>
                <div className="h-80 w-full">
                    <Bar data={chartData} options={options} />
                </div>
            </div>
        </>
    );
};

export default PerformanceStats;