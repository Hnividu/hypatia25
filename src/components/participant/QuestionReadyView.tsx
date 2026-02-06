'use client';

import { motion, AnimatePresence } from 'framer-motion';
import styles from './QuestionReadyView.module.css';

interface QuestionReadyViewProps {
    questionNumber: number;
    totalQuestions: number;
    countdown: number; // 3, 2, 1, 0
}

export default function QuestionReadyView({
    questionNumber,
    totalQuestions,
    countdown
}: QuestionReadyViewProps) {
    return (
        <div className={styles.container}>
            <motion.div
                className={styles.content}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                {/* Heading */}
                <motion.h1
                    className={styles.heading}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    Be Ready For
                </motion.h1>

                {/* Question Number Badge */}
                <motion.div
                    className={styles.questionBadge}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                >
                    <span className={styles.label}>Question</span>
                    <span className={styles.number}>{questionNumber}</span>
                    <span className={styles.total}>of {totalQuestions}</span>
                </motion.div>

                {/* Animated Countdown */}
                <div className={styles.countdownWrapper}>
                    <div className={styles.countdownRing}>
                        <svg viewBox="0 0 100 100" className={styles.ringProgress}>
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                className={styles.ringBg}
                            />
                            <motion.circle
                                cx="50"
                                cy="50"
                                r="45"
                                className={styles.ringFill}
                                initial={{ pathLength: 1 }}
                                animate={{ pathLength: countdown / 3 }}
                                transition={{ duration: 0.3 }}
                            />
                        </svg>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={countdown}
                            className={styles.countdownNumber}
                            initial={{ opacity: 0, scale: 1.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.3, type: "spring" }}
                        >
                            {countdown > 0 ? countdown : "GO!"}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Subtext */}
                <motion.p
                    className={styles.subtext}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    Get focused and prepare to answer!
                </motion.p>
            </motion.div>

            {/* Background Particles Effect */}
            <div className={styles.particles}>
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className={styles.particle}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{
                            opacity: [0, 0.5, 0],
                            y: [-50, -150],
                            x: Math.sin(i) * 50
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.3
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
