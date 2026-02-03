export const formatCustomDate = (dateString) => {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, "0");

  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};
