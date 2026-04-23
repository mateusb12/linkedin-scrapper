export const GOAL_PER_DAY = 10;
export const themeColors = {
  linkedin: "#8b5cf6",
  huntr: "#10b981",
  sql: "#3b82f6",
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
};

const APPLIED_DATE_FIELDS = [
  "appliedAt",
  "applied_at_brt",
  "applied_on",
  "applied_at",
];

export const getAppliedDateValue = (job) => {
  if (!job || typeof job !== "object") return null;

  for (const field of APPLIED_DATE_FIELDS) {
    const value = job[field];
    if (value) return value;
  }

  return null;
};

const isValidDate = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime());

const parseAppliedDate = (job) => {
  const value = getAppliedDateValue(job);
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
};

const getLocalYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ymdFromAppliedDate = (job) => {
  const value = getAppliedDateValue(job);

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = parseAppliedDate(job);
  return date ? getLocalYMD(date) : null;
};

const dateFromYMD = (ymd) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const emptyHistoryData = () => ({
  barData: {
    labels: [],
    datasets: [],
  },
  doughnutData: {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderWidth: 0,
      },
    ],
  },
});

const getISOWeekKey = (ymd) => {
  const [year, month, day] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

export const processCurrentFormData = (jobs) => {
  const allDailyCounts = {};
  const jobList = Array.isArray(jobs) ? jobs : [];

  let minDate = null;
  jobList.forEach((job) => {
    const k = ymdFromAppliedDate(job);
    if (!k) return;

    const d = dateFromYMD(k);
    if (!minDate || d < minDate) minDate = d;
    allDailyCounts[k] = (allDailyCounts[k] || 0) + 1;
  });

  const startDate = minDate ? new Date(minDate) : new Date();
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
  if (!jobs?.length) return emptyHistoryData();
  const appsBySource = {};
  const appsPerPeriod = {};

  jobs.forEach((job) => {
    const dateKey = ymdFromAppliedDate(job);
    if (!dateKey) return;

    const source = job.source || "Unknown";
    appsBySource[source] = (appsBySource[source] || 0) + 1;
    let key = dateKey;

    if (timePeriod === "monthly") key = dateKey.slice(0, 7);
    else if (timePeriod === "weekly") key = getISOWeekKey(dateKey);

    if (!appsPerPeriod[key]) appsPerPeriod[key] = {};
    appsPerPeriod[key][source] = (appsPerPeriod[key][source] || 0) + 1;
  });

  const sources = Object.keys(appsBySource);
  if (sources.length === 0) return emptyHistoryData();

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
