import {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  isValidElement,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const activeKeys = useRef(new Set());

  const removeToast = (id) => {
    setToasts((prev) => {
      const toastToRemove = prev.find((t) => t.id === id);
      if (toastToRemove && toastToRemove.dedupKey) {
        activeKeys.current.delete(toastToRemove.dedupKey);
      }
      return prev.filter((toast) => toast.id !== id);
    });
  };

  const addToast = ({
    message: content,
    type = "success",
    duration = 4000,
  }) => {
    let dedupKey = "";

    try {
      if (typeof content === "string") {
        dedupKey = content;
      } else if (isValidElement(content)) {
        const getTextFromProps = (node) => {
          if (typeof node === "string" || typeof node === "number")
            return String(node);
          if (Array.isArray(node)) return node.map(getTextFromProps).join("");
          if (node?.props?.children)
            return getTextFromProps(node.props.children);
          return "";
        };
        dedupKey = getTextFromProps(content) || "react-component-message";
      } else if (content instanceof Error) {
        dedupKey = content.message;
        content = content.message;
      } else if (typeof content === "object") {
        dedupKey = JSON.stringify(content);
      } else {
        dedupKey = String(content);
      }
    } catch (e) {
      dedupKey = "unknown-error-" + Date.now();
    }

    if (
      dedupKey.toLowerCase().includes("timeout") ||
      dedupKey.toLowerCase().includes("network") ||
      dedupKey.toLowerCase().includes("demorou muito")
    ) {
      dedupKey = "network-error-grouped";
    }

    if (activeKeys.current.has(dedupKey)) {
      return null;
    }

    activeKeys.current.add(dedupKey);

    const id = Date.now() + Math.random();

    const toast = {
      id,
      message: content,
      dedupKey,
      type,
      duration,
      startTime: Date.now(),
    };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const success = (message, duration) =>
    addToast({ message, type: "success", duration });
  const error = (message, duration) =>
    addToast({ message, type: "error", duration });
  const warning = (message, duration) =>
    addToast({ message, type: "warning", duration });
  const info = (message, duration) =>
    addToast({ message, type: "info", duration });

  return (
    <ToastContext.Provider
      value={{ success, error, warning, info, removeToast }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>,
    document.body,
  );
};

const toastStyles = {
  base: `
    relative overflow-hidden
    min-w-[320px] max-w-[420px]
    p-4 rounded-xl shadow-xl
    transform transition-all duration-300 ease-out
    backdrop-blur-sm
  `,
  background: {
    light: "bg-white/95 border border-gray-200/50",
    dark: "bg-gray-800/95 border border-gray-700/50",
  },
  text: {
    light: "text-gray-900",
    dark: "text-white",
  },
  transition: {
    entering: "translate-x-0 opacity-100 scale-100",
    hidden: "translate-x-full opacity-0 scale-95",
  },
};

const toastConfig = {
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    iconColor: "text-green-500",
    progressColor: "bg-green-500",
  },
  error: {
    icon: <XCircle className="w-5 h-5" />,
    iconColor: "text-red-500",
    progressColor: "bg-red-500",
  },
  warning: {
    icon: <AlertCircle className="w-5 h-5" />,
    iconColor: "text-amber-500",
    progressColor: "bg-amber-500",
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    iconColor: "text-blue-500",
    progressColor: "bg-blue-500",
  },
};

const Toast = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const config = toastConfig[toast.type] || toastConfig.success;

  useEffect(() => {
    const enterTimeout = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(enterTimeout);
  }, []);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0 || isPaused) return;

    const startTime = toast.startTime;
    const updateInterval = 50;

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, toast.duration - elapsed);
      const progressPercent = (remaining / toast.duration) * 100;

      setProgress(progressPercent);

      if (remaining <= 0) {
        clearInterval(progressInterval);
      }
    }, updateInterval);

    return () => clearInterval(progressInterval);
  }, [toast.duration, toast.startTime, isPaused]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  const getToastClasses = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const backgroundStyle = isDark
      ? toastStyles.background.dark
      : toastStyles.background.light;
    const textStyle = isDark ? toastStyles.text.dark : toastStyles.text.light;

    let transitionStyle = toastStyles.transition.hidden;
    if (isVisible && !isExiting) {
      transitionStyle = toastStyles.transition.entering;
    }

    return `${toastStyles.base} ${backgroundStyle} ${textStyle} ${transitionStyle}`;
  };

  return (
    <div
      className={getToastClasses()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex-1 text-sm font-medium leading-5 break-words">
          {toast.message}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4 opacity-60 hover:opacity-100" />
        </button>
      </div>

      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-75 ease-linear ${config.progressColor}`}
            style={{
              width: `${progress}%`,
              transitionDuration: isPaused ? "0ms" : "75ms",
            }}
          />
        </div>
      )}
    </div>
  );
};
