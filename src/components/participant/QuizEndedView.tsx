'use client';

import { motion } from 'framer-motion';
import styles from './QuizEndedView.module.css';

export default function QuizEndedView() {
    return (
        <div className={styles.container}>
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className={styles.title}>Quiz Session Has Ended!</h1>
                <p className={styles.message}>
                    Thank you for participating.<br />
                    We'll let you know the leaderboard results soon.
                </p>
                <div className={styles.brand}>Hypatia Quiz - MCSS Team</div>
            </motion.div>
        </div>
    );
}
