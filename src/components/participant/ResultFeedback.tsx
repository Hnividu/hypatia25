'use client';

import { motion } from 'framer-motion';
import type { ScoreResult } from '@/types/quiz';
import { formatScore } from '@/lib/scoring';
import styles from './ResultFeedback.module.css';

interface ResultFeedbackProps {
    result: ScoreResult;
}

export default function ResultFeedback({ result }: ResultFeedbackProps) {
    return (
        <div className={`${styles.container} ${result.correct ? styles.correct : styles.incorrect}`}>
            <motion.div
                className={styles.content}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
                {/* Result Icon */}
                <motion.div
                    className={styles.iconWrapper}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
                >
                    {result.correct ? (
                        <div className={styles.icon}>
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                <motion.path
                                    d="M16 32L28 44L48 20"
                                    stroke="currentColor"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                />
                            </svg>
                        </div>
                    ) : (
                        <div className={styles.icon}>
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                <motion.path
                                    d="M20 20L44 44M44 20L20 44"
                                    stroke="currentColor"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                />
                            </svg>
                        </div>
                    )}
                </motion.div>

                {/* Result Text */}
                <motion.h2
                    className={styles.resultText}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    {result.correct ? 'Correct!' : 'Incorrect'}
                </motion.h2>

                {/* Points */}
                {result.correct && (
                    <motion.div
                        className={styles.points}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <span className={styles.pointsValue}>+{formatScore(result.totalPoints)}</span>
                        <span className={styles.pointsLabel}>points</span>
                    </motion.div>
                )}

                {/* Breakdown */}
                {result.correct && result.speedBonus > 0 && (
                    <motion.div
                        className={styles.breakdown}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className={styles.breakdownRow}>
                            <span>Base Points</span>
                            <span>{formatScore(result.basePoints)}</span>
                        </div>
                        <div className={styles.breakdownRow}>
                            <span>Speed Bonus</span>
                            <span className={styles.bonus}>+{formatScore(result.speedBonus)}</span>
                        </div>
                    </motion.div>
                )}

                {/* Time taken */}
                <motion.p
                    className={styles.time}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    Answered in {(result.timeTaken / 1000).toFixed(1)}s
                </motion.p>
            </motion.div>
        </div>
    );
}
