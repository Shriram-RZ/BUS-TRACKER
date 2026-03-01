import { ReactNode } from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
    children: ReactNode;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    className?: string;
}

export function AnimatedButton({
    children,
    variant = "primary",
    className,
    ...props
}: AnimatedButtonProps) {
    const baseClasses =
        "relative overflow-hidden rounded-xl font-medium px-6 py-3 transition-colors duration-300 flex items-center justify-center gap-2";

    const getVariantStyles = () => {
        switch (variant) {
            case "primary":
                return "bg-indigo-600 text-white hover:bg-indigo-500 premium-glow";
            case "secondary":
                return "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5";
            case "danger":
                return "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/20 hover:border-red-500/50";
            case "ghost":
                return "bg-transparent text-slate-300 hover:text-white hover:bg-white/5";
            default:
                return "bg-indigo-600 text-white";
        }
    };

    return (
        <motion.button
            {...props}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className={cn(baseClasses, getVariantStyles(), className)}
        >
            {/* Ripple effect placeholder styling */}
            <span className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100 mix-blend-overlay"></span>
            <span className="relative z-10 flex items-center gap-2">{children}</span>
        </motion.button>
    );
}
