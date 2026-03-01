import { ReactNode } from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export function GlassCard({
    children,
    className,
    hoverEffect = true,
    ...props
}: GlassCardProps) {
    return (
        <motion.div
            {...props}
            whileHover={
                hoverEffect
                    ? {
                        y: -4,
                        scale: 1.01,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                        borderColor: "rgba(255, 255, 255, 0.15)",
                    }
                    : undefined
            }
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
                "glass-card rounded-2xl p-6 transition-colors duration-300",
                className
            )}
        >
            {children}
        </motion.div>
    );
}
