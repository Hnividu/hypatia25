'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import styles from './MCQQuestion.module.css';

interface MCQOption {
    id: string;
    text: string;
}

interface MCQQuestionProps {
    questionText: string;
    options: MCQOption[];
    questionNumber: number;
    totalQuestions: number;
    timeRemaining: number;
    timeLimit: number;
    doublePoints: boolean;
    disabled?: boolean;
    onAnswer: (optionId: string) => void;
}

const optionVariants = ['option-a', 'option-b', 'option-c', 'option-d'] as const;
const optionIcons = ['▲', '◆', '●', '■'];

export default function MCQQuestion({
    questionText,
    options,
    questionNumber,
    totalQuestions,
    timeRemaining,
    timeLimit,
    doublePoints,
    disabled = false,
    onAnswer,
}: MCQQuestionProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleSelect = (optionId: string) => {
        if (disabled || selectedOption) return;
        setSelectedOption(optionId);
        onAnswer(optionId);
    };

    const progressPercentage = (timeRemaining / timeLimit) * 100;
    const isUrgent = timeRemaining <= 5;

    return (
        <div className={styles.container}>
            {/* Header with timer */}
            <div className={styles.header}>
                <div className={styles.questionInfo}>
                    <span className={styles.questionNumber}>
                        Question {questionNumber} of {totalQuestions}
                    </span>
                    {doublePoints && (
                        <span className={styles.doublePoints}>2x Points</span>
                    )}
                </div>

                <div className={styles.timer}>
                    <div className={styles.timerBar}>
                        <motion.div
                            className={`${styles.timerProgress} ${isUrgent ? styles.urgent : ''}`}
                            initial={{ width: '100%' }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    <span className={`${styles.timerText} ${isUrgent ? styles.urgent : ''}`}>
                        {timeRemaining}s
                    </span>
                </div>
            </div>

            {/* Question */}
            <motion.div
                className={styles.question}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h2 className={styles.questionText}>{questionText}</h2>
            </motion.div>

            {/* Options */}
            <div className={styles.optionsGrid}>
                {options.map((option, index) => (
                    <motion.button
                        key={option.id}
                        className={`
              ${styles.option}
              ${styles[optionVariants[index]]}
              ${selectedOption === option.id ? styles.selected : ''}
              ${selectedOption && selectedOption !== option.id ? styles.dimmed : ''}
            `}
                        onClick={() => handleSelect(option.id)}
                        disabled={disabled || !!selectedOption}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        whileHover={!disabled && !selectedOption ? { scale: 1.02 } : undefined}
                        whileTap={!disabled && !selectedOption ? { scale: 0.98 } : undefined}
                    >
                        <span className={styles.optionIcon}>{optionIcons[index]}</span>
                        <span className={styles.optionText}>{option.text}</span>
                    </motion.button>
                ))}
            </div>

            {/* Submitted state */}
            {selectedOption && (
                <motion.div
                    className={styles.submitted}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className={styles.submittedIcon}>✓</div>
                    <span>Answer submitted!</span>
                </motion.div>
            )}
        </div>
    );
}
