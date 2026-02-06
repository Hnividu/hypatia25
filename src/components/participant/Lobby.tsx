'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Participant } from '@/types/quiz';
import styles from './Lobby.module.css';

interface LobbyProps {
    quizTitle: string;
    sessionCode: string;
    participants: Participant[];
    isAdmin?: boolean;
    onStart?: () => void;
    currentUserId?: string;
}

export default function Lobby({
    quizTitle,
    sessionCode,
    participants,
    isAdmin = false,
    onStart,
    currentUserId,
}: LobbyProps) {
    return (
        <div className={styles.lobby}>
            <div className={styles.header}>
                <h1 className={styles.title}>{quizTitle}</h1>
                <div className={styles.logoContainer}>
                    <Image
                        src="/MCSS.png"
                        alt="MCSS Logo"
                        width={80}
                        height={80}
                        className={styles.logo}
                        priority
                    />
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.participantCount}>
                    <motion.span
                        key={participants.length}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={styles.count}
                    >
                        {participants.length}
                    </motion.span>
                    <span className={styles.countLabel}>
                        {participants.length === 1 ? 'Participant' : 'Participants'}
                    </span>
                </div>

                <div className={styles.participantGrid}>
                    <AnimatePresence>
                        {participants.map((participant, index) => (
                            <motion.div
                                key={participant.regId}
                                className={`${styles.participantCard} ${currentUserId === participant.regId ? styles.currentUser : ''
                                    }`}
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 25,
                                    delay: index * 0.05,
                                }}
                            >
                                <div className={styles.avatar}>
                                    {participant.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={styles.name}>{participant.name}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {participants.length === 0 && (
                    <div className={styles.waiting}>
                        <div className={styles.spinner} />
                        <p>Waiting for participants to join...</p>
                    </div>
                )}
            </div>

            {isAdmin && (
                <div className={styles.adminControls}>
                    <button
                        className={styles.startButton}
                        onClick={onStart}
                        disabled={participants.length === 0}
                    >
                        Start Quiz
                    </button>
                </div>
            )}

            {/* Footer is always visible now */}
            {/* {!isAdmin && ( */}
            {!isAdmin && <p className={styles.readyText}>Get ready! The quiz will start soon.</p>}
            <div className={styles.footer}>
                <div className={styles.copyright}>
                    <p>© 2025 Mahanama College Science Society. All rights reserved.</p>
                    <p className={styles.developer}>Developed by Hirosh Nividu • Fellow Mahanamian</p>
                </div>
            </div>
            {/* )} */}
        </div>
    );
}
