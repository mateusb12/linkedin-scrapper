export const GOAL_PER_DAY = 10;
export const themeColors = {
  linkedin: "#8b5cf6",
  huntr: "#10b981",
  sql: "#3b82f6",
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
};

export const processCurrentFormData = (jobs) => {
  const allDailyCounts = {};
  const getLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let minDate = new Date();
  jobs.forEach((job) => {
    if (!job.appliedAt) return;
    const d = new Date(job.appliedAt);
    if (d < minDate) minDate = d;
    const k = getLocalYMD(d);
    allDailyCounts[k] = (allDailyCounts[k] || 0) + 1;
  });

  const startDate = new Date(minDate);
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1);

  const fullHistoryStats = {};
  let previousDayOverflow = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = getLocalYMD(d);
    const realCount = allDailyCounts[key] || 0;

    const currentBonus = previousDayOverflow;
    const usedProtection = currentBonus > 0;
    const effectiveCount = realCount + currentBonus;

    fullHistoryStats[key] = {
      real: realCount,
      bonus: currentBonus,
      effective: effectiveCount,
      isProtected: usedProtection,
    };

    if (realCount > GOAL_PER_DAY && !usedProtection) {
      previousDayOverflow = Math.min(realCount - GOAL_PER_DAY, GOAL_PER_DAY);
    } else {
      previousDayOverflow = 0;
    }
  }

  const last7DaysLabels = [];
  const realDataValues = [];
  const bonusDataValues = [];
  const today = new Date();

  for (let i = 6; i >= -1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getLocalYMD(d);

    const stat = fullHistoryStats[key] || { real: 0, bonus: 0 };

    last7DaysLabels.push(
      d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    );
    realDataValues.push(stat.real);
    bonusDataValues.push(stat.bonus);
  }

  const todayKey = getLocalYMD(today);
  const todayStats = fullHistoryStats[todayKey] || {
    real: 0,
    bonus: 0,
    effective: 0,
  };

  let streak = 0;
  const checkDate = new Date();
  for (let i = 0; i < 365; i++) {
    const k = getLocalYMD(checkDate);
    const stat = fullHistoryStats[k] || { effective: 0 };
    const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;

    if (stat.effective >= GOAL_PER_DAY) streak++;
    else if (i === 0 && stat.effective < GOAL_PER_DAY) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    } else if (!isWeekend) break;

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    labels: last7DaysLabels,
    realData: realDataValues,
    bonusData: bonusDataValues,
    todayCount: todayStats.effective,
    todayReal: todayStats.real,
    streak,
    dailyStats: fullHistoryStats,
    allDailyCounts,
  };
};

export const processHistoryData = (jobs, timePeriod) => {
  if (!jobs?.length) return { barData: null, doughnutData: null };
  const appsBySource = {};
  const appsPerPeriod = {};

  jobs.forEach((job) => {
    const source = job.source || "Unknown";
    appsBySource[source] = (appsBySource[source] || 0) + 1;
    const date = new Date(job.appliedAt);
    let key = date.toISOString().split("T")[0];

    if (timePeriod === "monthly")
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    else if (timePeriod === "weekly") {
      const d = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const weekNo = Math.ceil(
        ((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7,
      );
      key = `${d.getUTCFullYear()}-W${weekNo}`;
    }

    if (!appsPerPeriod[key]) appsPerPeriod[key] = {};
    appsPerPeriod[key][source] = (appsPerPeriod[key][source] || 0) + 1;
  });

  const sources = Object.keys(appsBySource);
  const colors = sources.map((s) => {
    if (s.toLowerCase().includes("linkedin")) return themeColors.linkedin;
    if (s.toLowerCase().includes("huntr")) return themeColors.huntr;
    return themeColors.sql;
  });

  return {
    doughnutData: {
      labels: sources,
      datasets: [
        {
          data: Object.values(appsBySource),
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    barData: {
      labels: Object.keys(appsPerPeriod).sort(),
      datasets: sources.map((source, i) => ({
        label: source,
        data: Object.keys(appsPerPeriod)
          .sort()
          .map((k) => appsPerPeriod[k][source] || 0),
        backgroundColor: colors[i],
        stack: "stack1",
      })),
    },
  };
};
