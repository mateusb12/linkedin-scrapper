export const extractExperienceFromDescription = (description) => {
  if (!description) return null;

  const regex =
    /\b(\d+)(?:\s*[-–to]\s*(\d+))?\s*(?:\+|plus|\s*mais)?\s*(?:years?|yrs?|anos?)\b/i;

  const match = description.match(regex);

  if (match) {
    const min = parseInt(match[1], 10);
    const max = match[2] ? parseInt(match[2], 10) : null;

    if (min > 20) return null;

    return {
      min,
      max,
      text: match[0],
    };
  }

  return null;
};

export const getExperienceStyle = (experience) => {
  if (!experience)
    return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";

  const minYears = experience.min ?? 0;

  if (minYears <= 4)
    return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

  if (minYears <= 6)
    return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800";
};

export const getCompetitionStyle = (applicants) => {
  if (applicants == null)
    return "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";

  if (applicants < 300)
    return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";

  if (applicants < 1000)
    return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200 dark:border-red-800";
};

export const cleanJobDescription = (rawText) => {
  if (!rawText) return "No description available.";

  const lines = rawText.split("\n");
  const garbagePatterns = [
    /^div$/,
    /^com\.linkedin\..*/,
    /^stringValue$/,
    /^Collapsed$/,
    /^bindableBoolean$/,
    /^booleanBinding$/,
    /^Expanded$/,
    /^onComponentDisappear$/,
    /^horizontal$/,
    /^h2$/,
    /^sans$/,
    /^small$/,
    /^normal$/,
    /^open$/,
    /^start$/,
    /^strong$/,
    /^text-attr-\d+$/,
    /^more$/,
    /^expandable_text_block.*/,
  ];

  const cleanedLines = lines
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return false;
      return !garbagePatterns.some((pattern) => pattern.test(line));
    })
    .map((line) => {
      if (line === "li" || line === "ul") return "• ";
      if (line === "br") return "";
      return line;
    });

  let text = cleanedLines.join("\n");
  text = text.replace(/([a-z])\*\*([A-Z])/g, "$1\n\n**$2");
  text = text.replace(/\n\*\*/g, "\n\n**");
  const unicodeBullets = /[✔✨✅•➡🔹🔸▪]/g;
  text = text.replace(new RegExp(`\\n([✔✨✅•➡🔹🔸▪])`, "g"), "\n\n$1");

  return text;
};
