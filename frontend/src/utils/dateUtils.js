export const formatCustomDate = (dateString) => {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, "0");

  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatShortDateTime = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month} ${hours}:${minutes}`;
};

export const formatTimeAgo = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  let diff = now - date;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return "(now)";
  if (minutes < 60) return `(${minutes}m ago)`;

  if (hours < 24) return `(${hours}h ago)`;

  if (days < 30) return `(${days}d ago)`;

  if (months < 12) {
    const remainingDays = days % 30;
    return remainingDays > 0
      ? `(${months}m${remainingDays}d ago)`
      : `(${months}m ago)`;
  }

  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `(${years}y${remainingMonths}m ago)`
    : `(${years}y ago)`;
};
