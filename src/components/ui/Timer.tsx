'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Timer.module.css';

interface TimerProps {
    duration: number; // Total time in seconds
    onComplete?: () => void;
    onTick?: (remaining: number) => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
    autoStart?: boolean;
    paused?: boolean;
}

export default function Timer({
    duration,
    onComplete,
    onTick,
    size = 'md',
    showLabel = true,
    autoStart = true,
    paused = false,
}: TimerProps) {
    const [timeRemaining, setTimeRemaining] = useState(duration);
    const [isRunning, setIsRunning] = useState(autoStart);

    const percentage = (timeRemaining / duration) * 100;
    const isUrgent = timeRemaining <= 5;
    const isWarning = timeRemaining <= 10 && timeRemaining > 5;

    useEffect(() => {
        if (!isRunning || paused) return;

        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                const next = prev - 1;
                onTick?.(next);

                if (next <= 0) {
                    clearInterval(interval);
                    setIsRunning(false);
                    onComplete?.();
                    return 0;
                }

                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, paused, onComplete, onTick]);

    // Reset when duration changes
    useEffect(() => {
        setTimeRemaining(duration);
        setIsRunning(autoStart);
    }, [duration, autoStart]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
    };

    const getStatusClass = () => {
        if (isUrgent) return styles.urgent;
        if (isWarning) return styles.warning;
        return styles.normal;
    };

    return (
        <div className={`${styles.timer} ${styles[size]} ${getStatusClass()}`}>
            {/* Circular progress */}
            <svg className={styles.circle} viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                    className={styles.bgCircle}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="8"
                />
                {/* Progress circle */}
                <motion.circle
                    className={styles.progressCircle}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - percentage / 100)}`}
                    transform="rotate(-90 50 50)"
                    initial={false}
                    animate={{ strokeDashoffset: `${2 * Math.PI * 45 * (1 - percentage / 100)}` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                />
            </svg>

            {/* Time display */}
            <div className={styles.timeDisplay}>
                <AnimatePresence mode="wait">
                    <motion.span
                        key={timeRemaining}
                        className={styles.time}
                        initial={{ opacity: 0, scale: 1.2 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                    >
                        {formatTime(timeRemaining)}
                    </motion.span>
                </AnimatePresence>
                {showLabel && <span className={styles.label}>seconds</span>}
            </div>
        </div>
    );
}

// Compact inline timer for question headers
export function InlineTimer({
    duration,
    remaining,
    size = 'sm',
}: {
    duration: number;
    remaining: number;
    size?: 'sm' | 'md';
}) {
    const percentage = (remaining / duration) * 100;
    const isUrgent = remaining <= 5;
    const isWarning = remaining <= 10 && remaining > 5;

    const getColor = () => {
        if (isUrgent) return 'var(--color-danger)';
        if (isWarning) return 'var(--color-warning)';
        return 'var(--color-primary)';
    };

    return (
        <div className={`${styles.inlineTimer} ${styles[`inline-${size}`]}`}>
            <div className={styles.progressBar}>
                <motion.div
                    className={styles.progressFill}
                    style={{ backgroundColor: getColor() }}
                    initial={false}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
            <span className={styles.inlineTime} style={{ color: getColor() }}>
                {remaining}s
            </span>
        </div>
    );
}
