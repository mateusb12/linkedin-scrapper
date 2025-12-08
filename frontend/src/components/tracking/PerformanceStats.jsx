import React from 'react';
import { Bar } from 'react-chartjs-2';
import targetIcon from '../../assets/ui_icons/target.png';
import fireIcon from '../../assets/ui_icons/fire.png';
import calendarIcon from '../../assets/ui_icons/calendar.png';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components locally
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const GOAL_PER_DAY = 10;
const themeColors = {
    textSecondary: '#9ca3af',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    protection: '#3b82f6' // Blue for the protection bar
};

// Reusable Stat Card
const StatCard = ({ title, value, suffix, subtext, iconSrc, colorClass, children }) => {
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
                {/* Render children if provided (for custom badges), else render subtext pill */}
                {children ? children : subtext && (
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

    // --- OFFENSIVE PROTECTION STATUS ---
    // Calculate if we have protection for tomorrow or if we are using it today
    // stats.bonusData is an array of last 7 days. Last element is Today.
    const todayBonus = stats.bonusData[stats.bonusData.length - 1];
    const todayReal = stats.realData[stats.realData.length - 1];

    // Check if we are generating a shield for tomorrow
    // Logic: If real > 10 AND we aren't using a shield today (todayBonus == 0)
    const generatedForTomorrow = (todayReal > GOAL_PER_DAY && todayBonus === 0)
        ? Math.min(todayReal - GOAL_PER_DAY, GOAL_PER_DAY)
        : 0;

    // Stacked Chart Configuration
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
                label: 'Protection Credits', // The Blue Bar
                data: stats.bonusData,
                backgroundColor: themeColors.protection,
                borderRadius: 4,
                stack: 'Stack 0', // Enables Stacking
                order: 1
            },
            {
                type: 'bar',
                label: 'Real Applications',
                data: stats.realData,
                backgroundColor: stats.realData.map((val, index) => {
                    const total = val + stats.bonusData[index]; // Color based on EFFECTIVE total
                    if (total >= GOAL_PER_DAY) return themeColors.success;
                    if (total >= (GOAL_PER_DAY / 2)) return themeColors.warning;
                    return themeColors.danger;
                }),
                borderRadius: 4,
                stack: 'Stack 0', // Enables Stacking
                order: 2
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: true, labels: { color: themeColors.textSecondary } },
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx) => {
                        if (ctx.dataset.type === 'line') return ` Goal: ${ctx.raw}`;
                        return ` ${ctx.dataset.label}: ${ctx.raw}`;
                    },
                    footer: (tooltipItems) => {
                        // Sum up the bars in the tooltip footer
                        let total = 0;
                        tooltipItems.forEach(t => {
                            if(t.dataset.type === 'bar') total += t.raw;
                        });
                        return ` Total: ${total}`;
                    }
                }
            }
        },
        scales: {
            y: {
                stacked: true, // IMPORTANT: Stacks the bars
                beginAtZero: true,
                grid: { color: 'rgba(75, 85, 99, 0.2)' },
                ticks: { color: themeColors.textSecondary }
            },
            x: {
                stacked: true, // IMPORTANT: Stacks the bars
                grid: { display: false },
                ticks: { color: themeColors.textSecondary }
            }
        }
    };

    return (
        <>
            {/* 1. Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-10 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Custom Today's Progress Card to show split */}
                <StatCard
                    title="Today's Progress"
                    value={stats.todayCount}
                    suffix={`/ ${GOAL_PER_DAY}`}
                    iconSrc={targetIcon}
                    colorClass={stats.todayCount >= GOAL_PER_DAY ? "text-green-400" : "text-amber-400"}
                >
                    <div className="flex flex-col gap-1">
                        {todayBonus > 0 && (
                            <div className="text-[10px] font-bold px-2 py-0.5 rounded w-fit bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {todayReal} Real + {todayBonus} Bonus
                            </div>
                        )}
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${stats.todayCount >= GOAL_PER_DAY ? "bg-green-400/10 text-green-400" : "bg-amber-400/10 text-amber-400"}`}>
                            {getMotivation()}
                        </div>
                    </div>
                </StatCard>

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
                    // Display Sum of Real Data only (don't double count bonus in total productivity)
                    value={stats.realData.reduce((a, b) => a + b, 0)}
                    subtext="Last 7 Days (Real)"
                    iconSrc={calendarIcon}
                    colorClass="text-purple-400"
                />
            </div>

            {/* 2. Chart with Protection Status Banner */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">Daily Performance</h3>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-3 h-3 rounded bg-green-500"></span> Real Apps
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-3 h-3 rounded bg-blue-500"></span> Protection
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator Logic */}
                    <div className="flex flex-col items-end">
                        {todayBonus > 0 ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-medium">
                                <ShieldCheck size={16} />
                                <span>Protection Active (+{todayBonus})</span>
                            </div>
                        ) : generatedForTomorrow > 0 ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm font-medium">
                                <Shield size={16} />
                                <span>Building Shield (+{generatedForTomorrow})</span>
                            </div>
                        ) : (todayReal > GOAL_PER_DAY && todayBonus > 0) ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 text-sm font-medium" title="Cannot build shield while using one">
                                <ShieldAlert size={16} />
                                <span>Shield Cooldown</span>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-500 px-3 py-1 bg-gray-900 rounded-full border border-gray-700">
                                Goal: {GOAL_PER_DAY}/day
                            </span>
                        )}
                    </div>
                </div>

                <div className="h-80 w-full">
                    <Bar data={chartData} options={options} />
                </div>
            </div>
        </>
    );
};

export default PerformanceStats;