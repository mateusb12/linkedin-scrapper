import { motion } from 'framer-motion';
export const SkillBadge = ({ skill }) => (
  <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300 transition-transform hover:scale-105">
    {skill}
  </div>
);

export const InfoPill = ({ icon, text, className }) => (
    <div className={`flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-sm ${className}`}>
        {icon}
        <span className="font-medium">{text}</span>
    </div>
);

export const ActionButton = ({ onClick, icon, colorClass, hoverColorClass }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={`p-4 rounded-full shadow-lg transition-colors duration-300 ${colorClass} ${hoverColorClass}`}
  >
    {icon}
  </motion.button>
);