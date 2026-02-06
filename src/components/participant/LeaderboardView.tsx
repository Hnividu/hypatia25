'use client';

import { motion } from 'framer-motion';
import { LeaderboardData } from '@/lib/socket/events';
import styles from './LeaderboardView.module.css';

interface LeaderboardViewProps {
    data: LeaderboardData | null;
    currentUserId: string;
}

export default function LeaderboardView({ data, currentUserId }: LeaderboardViewProps) {
    if (!data || !data.rankings) {
        return <div className={styles.loading}>Loading leaderboard...</div>;
    }

    // Sort rankings by total score (descending)
    const sortedRankings = [...data.rankings].sort((a, b) => b.totalScore - a.totalScore);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Leaderboard</h1>
                <p className={styles.subtitle}>Top Performers</p>
            </div>

            <div className={styles.list}>
                {sortedRankings.map((entry, index) => (
                    <motion.div
                        key={entry.participantId}
                        className={`${styles.entry} ${entry.participantId === currentUserId ? styles.currentUser : ''
                            }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <div className={styles.rank}>
                            {index + 1}
                        </div>
                        <div className={styles.info}>
                            <span className={styles.name}>{entry.participantName}</span>
                        </div>
                        <div className={styles.score}>
                            <span className={styles.scoreValue}>{entry.totalScore}</span>
                            <span className={styles.scoreLabel}>pts</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
