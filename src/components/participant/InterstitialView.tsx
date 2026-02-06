'use client';

import { motion } from 'framer-motion';
import styles from './InterstitialView.module.css';

interface InterstitialViewProps {
    heading?: string;
    subtext?: string;
    displayValue?: string | number;
}

export default function InterstitialView({
    heading = "Get Ready!",
    subtext = "Next question is coming up...",
    displayValue
}: InterstitialViewProps) {
    return (
        <div className={styles.container}>
            <motion.div
                className={styles.content}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                <h1 className={styles.heading}>{heading}</h1>
                {displayValue && (
                    <div className={styles.valueContainer}>
                        <div className={styles.spinner}></div>
                        <span className={styles.value}>{displayValue}</span>
                    </div>
                )}
                <p className={styles.subtext}>{subtext}</p>
            </motion.div>
        </div>
    );
}
