'use client';

import { motion } from 'framer-motion';
import styles from './WaitingView.module.css';

interface WaitingViewProps {
    title: string;
    message: string;
    icon?: string;
}

export default function WaitingView({ title, message, icon = "⏳" }: WaitingViewProps) {
    return (
        <div className={styles.container}>
            <motion.div
                className={styles.content}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className={styles.iconWrapper}>
                    <span className={styles.icon}>{icon}</span>
                </div>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.message}>{message}</p>
            </motion.div>
        </div>
    );
}
