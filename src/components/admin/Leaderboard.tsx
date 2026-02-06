'use client';

import { motion } from 'framer-motion';
import type { LeaderboardData } from '@/lib/socket/events';
import { formatScore } from '@/lib/scoring';
import styles from './Leaderboard.module.css';

interface LeaderboardProps {
    data: LeaderboardData | null | undefined;
    showFullList?: boolean;
}

export default function Leaderboard({ data, showFullList = false }: LeaderboardProps) {
    if (!data || !data.rankings) {
        return <div style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Loading leaderboard...</div>;
    }

    const displayedRankings = showFullList
        ? data.rankings
        : data.rankings.slice(0, 5);

    const getMedalIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return null;
        }
    };

    return (
        <div className={styles.leaderboard}>
            <div className={styles.header}>
                <h2 className={styles.title}>Leaderboard</h2>
                <span className={styles.subtitle}>
                    {data.rankings.length} participants
                </span>
            </div>

            {/* Top 3 Podium (if enough participants) */}
            {data.rankings.length >= 3 && (
                <div className={styles.podium}>
                    {/* Second Place */}
                    <motion.div
                        className={`${styles.podiumItem} ${styles.second}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className={styles.podiumAvatar}>
                            {data.rankings[1].participantName.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.podiumName}>{data.rankings[1].participantName}</span>
                        <span className={styles.podiumScore}>{formatScore(data.rankings[1].totalScore)}</span>
                        <div className={`${styles.podiumBlock} ${styles.secondBlock}`}>
                            <span className={styles.podiumMedal}>🥈</span>
                        </div>
                    </motion.div>

                    {/* First Place */}
                    <motion.div
                        className={`${styles.podiumItem} ${styles.first}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={styles.podiumAvatar}>
                            {data.rankings[0].participantName.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.podiumName}>{data.rankings[0].participantName}</span>
                        <span className={styles.podiumScore}>{formatScore(data.rankings[0].totalScore)}</span>
                        <div className={`${styles.podiumBlock} ${styles.firstBlock}`}>
                            <span className={styles.podiumMedal}>🥇</span>
                        </div>
                    </motion.div>

                    {/* Third Place */}
                    <motion.div
                        className={`${styles.podiumItem} ${styles.third}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <div className={styles.podiumAvatar}>
                            {data.rankings[2].participantName.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.podiumName}>{data.rankings[2].participantName}</span>
                        <span className={styles.podiumScore}>{formatScore(data.rankings[2].totalScore)}</span>
                        <div className={`${styles.podiumBlock} ${styles.thirdBlock}`}>
                            <span className={styles.podiumMedal}>🥉</span>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Full List */}
            <div className={styles.list}>
                {displayedRankings.map((entry, index) => (
                    <motion.div
                        key={entry.participantId}
                        className={`${styles.listItem} ${entry.rank <= 3 ? styles.topThree : ''}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <div className={styles.rank}>
                            {getMedalIcon(entry.rank) || (
                                <span className={styles.rankNumber}>{entry.rank}</span>
                            )}
                        </div>
                        <div className={styles.avatar}>
                            {entry.participantName.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.info}>
                            <span className={styles.name}>{entry.participantName}</span>
                            <span className={styles.stats}>
                                {entry.correctAnswers} correct
                            </span>
                        </div>
                        <div className={styles.score}>{formatScore(entry.totalScore)}</div>
                    </motion.div>
                ))}
            </div>

            {!showFullList && data.rankings.length > 5 && (
                <div className={styles.moreCount}>
                    +{data.rankings.length - 5} more participants
                </div>
            )}
        </div>
    );
}
