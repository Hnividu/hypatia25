'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/lib/socket/client';
import Button from '@/components/ui/Button';
import Leaderboard from '@/components/admin/Leaderboard';
import styles from './AdminSessionPanel.module.css';

interface AdminSessionPanelProps {
    sessionId: string;
}

// Helper to format categorize answers into readable text
function formatCategorizeAnswer(
    placements: any[],
    categories?: { id: string; name: string }[],
    items?: { id: string; text: string }[]
): string {
    if (!placements || !Array.isArray(placements)) return '-';

    return placements.map(p => {
        const itemName = items?.find(i => i.id === p.itemId)?.text || p.itemId?.slice(-4) || '?';
        const catName = categories?.find(c => c.id === p.categoryId)?.name || p.categoryId;
        return `${itemName} → ${catName}`;
    }).join(', ');
}

export default function AdminSessionPanel({ sessionId }: AdminSessionPanelProps) {
    const {
        connected,
        sessionState,
        participants,
        startQuiz,
        nextQuestion,
        showLeaderboard,
        leaderboard,
        endQuiz,
        removeParticipant,
        killSwitch,
        resetQuiz,
        currentQuestion,
        questionStats,
        getQuestionStats,
        totalQuestions,
        questionNumber, // Pure question number (1-based)
    } = useSocket({ sessionId, isAdmin: true });

    const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);

    const status = sessionState?.status || 'lobby';

    const handleShowLeaderboard = () => {
        showLeaderboard(); // Fetches data from server
        setShowLeaderboardModal(true);
    };

    // Handle question selection from dropdown
    const handleQuestionSelect = (index: number) => {
        setSelectedQuestionIndex(index);
        getQuestionStats(index);
    };

    // Auto-update selected question when current question changes
    useEffect(() => {
        if (currentQuestion && currentQuestion.type !== 'section' && questionNumber > 0) {
            // questionNumber is 1-based, dropdown uses 0-based
            setSelectedQuestionIndex(questionNumber - 1);
        }
    }, [currentQuestion, questionNumber]);

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h2 className={styles.title}>Live Session</h2>
                <div className={styles.status}>
                    <span className={`${styles.statusDot} ${connected ? styles.connected : styles.disconnected}`} />
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>

            {/* Session Info */}
            <div className={styles.sessionInfo}>
                <div className={styles.infoItem}>
                    <span className={styles.label}>Session Code</span>
                    <span className={styles.value}>{sessionId.toUpperCase()}</span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.label}>Status</span>
                    <span className={`${styles.value} ${styles[status]}`}>{status.toUpperCase()}</span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.label}>Participants</span>
                    <span className={styles.value}>{participants.length}</span>
                </div>
            </div>

            {/* Current Question Display */}
            <AnimatePresence mode="wait">
                {currentQuestion && (
                    <motion.div
                        className={styles.questionSection}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        key={currentQuestion.id}
                    >
                        {currentQuestion.type === 'section' ? (
                            <div className={styles.sectionPreview}>
                                <span className={styles.sectionBadge}>SECTION CARD</span>
                                <h3 className={styles.questionText} style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                    {currentQuestion.title}
                                </h3>
                                <div className={styles.sectionContent}>
                                    {currentQuestion.content}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.questionHeader}>
                                    <span>Current Question</span>
                                    <div className={styles.questionMeta}>
                                        <span className={styles.questionTypeBadge}>{currentQuestion.type}</span>
                                        <span>{'timeLimit' in currentQuestion ? currentQuestion.timeLimit : 0}s</span>
                                        {'doublePoints' in currentQuestion && currentQuestion.doublePoints && <span>2x Points</span>}
                                    </div>
                                </div>
                                <p className={styles.questionText}>{currentQuestion.text}</p>

                                {/* MCQ Options */}
                                {currentQuestion.type === 'mcq' && 'options' in currentQuestion && (
                                    <div className={styles.optionsList}>
                                        {currentQuestion.options.map((opt) => (
                                            <div key={opt.id} className={styles.optionItem}>
                                                {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Categorize Items */}
                                {currentQuestion.type === 'categorize' && 'items' in currentQuestion && (
                                    <div className={styles.categorizeItems}>
                                        {currentQuestion.items.map((item) => (
                                            <span key={item.id} className={styles.categorizeItem}>
                                                {item.text}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Numerical Info */}
                                {currentQuestion.type === 'numerical' && (
                                    <div className={styles.optionItem} style={{ display: 'inline-block' }}>
                                        Waiting for numerical input...
                                    </div>
                                )}
                            </>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Section with Question Selector */}
            {(status !== 'lobby' || sessionState?.status === 'finished') && totalQuestions > 0 && (
                <div className={styles.statsSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 className={styles.sectionTitle} style={{ margin: 0 }}>Response Stats</h4>
                        <select
                            className={styles.questionSelector}
                            value={selectedQuestionIndex ?? ''}
                            onChange={(e) => handleQuestionSelect(Number(e.target.value))}
                        >
                            <option value="" disabled>Select Question</option>
                            {Array.from({ length: totalQuestions }, (_, i) => (
                                <option key={i} value={i}>
                                    Q{i + 1}{sessionState?.currentQuestionIndex === i ? ' (Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {questionStats && (
                        <>
                            <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                <strong>Q{questionStats.questionIndex + 1}:</strong> {questionStats.questionText?.slice(0, 80)}{questionStats.questionText?.length > 80 ? '...' : ''}
                                <span className={styles.questionTypeBadge} style={{ marginLeft: '0.5rem' }}>{questionStats.questionType}</span>
                            </p>
                            <div className={styles.tableWrapper}>
                                <table className={styles.statsTable}>
                                    <thead>
                                        <tr>
                                            <th>Participant</th>
                                            <th>Status</th>
                                            <th>Answer</th>
                                            <th>Time</th>
                                            <th>Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questionStats.stats.map((stat) => (
                                            <tr key={stat.regId} className={
                                                stat.isCorrect ? styles.rowCorrect :
                                                    (stat.points && stat.points > 0 && !stat.isCorrect ? styles.rowPartial :
                                                        (stat.isCorrect === false ? styles.rowWrong : ''))
                                            }>
                                                <td className={styles.colName}>{stat.name}</td>
                                                <td>
                                                    {stat.hasAnswered ?
                                                        (stat.isCorrect ? '✅' :
                                                            (stat.points && stat.points > 0 ? '⚠️' :
                                                                (stat.isCorrect === false ? '❌' : '⏳')))
                                                        : '...'}
                                                </td>
                                                <td className={styles.colAnswer}>
                                                    {stat.answer !== undefined ? (
                                                        questionStats.questionType === 'mcq' ?
                                                            (questionStats.options?.find(o => o.id === stat.answer)?.text || stat.answer) :
                                                            questionStats.questionType === 'categorize' ?
                                                                formatCategorizeAnswer(stat.answer, questionStats.categories, questionStats.items) :
                                                                stat.answer
                                                    ) : '-'}
                                                </td>
                                                <td>
                                                    {stat.timeTaken ? (stat.timeTaken / 1000).toFixed(2) + 's' : '-'}
                                                </td>
                                                <td>
                                                    {stat.points !== undefined ?
                                                        <span className={styles.pointsBadge}>
                                                            {stat.points}
                                                            {stat.speedBonus ? <span className={styles.bonus}>+{stat.speedBonus}</span> : ''}
                                                        </span>
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {!questionStats && selectedQuestionIndex !== null && (
                        <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>Loading stats...</p>
                    )}
                </div>
            )}

            {/* Quiz Controls */}
            <div className={styles.controls}>
                <h3 className={styles.sectionTitle}>Quiz Controls</h3>
                <div className={styles.buttonGrid}>
                    {status === 'lobby' && (
                        <Button onClick={startQuiz} disabled={participants.length === 0}>
                            ▶️ Start Quiz
                        </Button>
                    )}
                    {(status === 'question' || status === 'countdown') && (
                        <Button onClick={nextQuestion}>
                            ⏭️ Next
                        </Button>
                    )}
                    {status !== 'lobby' && (
                        <Button variant="secondary" onClick={handleShowLeaderboard}>
                            📊 View Leaderboard (Only for Admin)
                        </Button>
                    )}
                    {status !== 'finished' && (
                        <Button variant="secondary" onClick={endQuiz}>
                            🏁 End Quiz
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        onClick={() => {
                            if (confirm('Are you sure? This will reset everyone to the lobby.')) {
                                resetQuiz();
                            }
                        }}
                    >
                        🔄 Restart Quiz
                    </Button>
                </div>
            </div>

            {/* Leaderboard Modal */}
            <AnimatePresence>
                {showLeaderboardModal && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLeaderboardModal(false)}
                    >
                        <motion.div
                            className={styles.modalContent}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.modalHeader}>
                                <h3>Data View</h3>
                                <button className={styles.closeButton} onClick={() => setShowLeaderboardModal(false)}>×</button>
                            </div>
                            <div className={styles.modalBody}>
                                <Leaderboard data={leaderboard} showFullList={true} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Participant List */}
            <div className={styles.participants}>
                <h3 className={styles.sectionTitle}>Participants ({participants.length})</h3>
                <div className={styles.participantList}>
                    <AnimatePresence>
                        {participants.length === 0 ? (
                            <p className={styles.emptyMessage}>Waiting for participants to join...</p>
                        ) : (
                            participants.map((p) => (
                                <motion.div
                                    key={p.regId}
                                    className={styles.participantCard}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className={styles.participantInfo}>
                                        <span className={`${styles.connectionDot} ${p.connected ? styles.online : styles.offline}`} />
                                        <span className={styles.participantName}>{p.name}</span>
                                        <span className={styles.participantId}>{p.regId}</span>
                                    </div>
                                    <button
                                        className={styles.removeButton}
                                        onClick={() => removeParticipant(p.regId)}
                                        title="Remove Participant"
                                    >
                                        ✕
                                    </button>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Kill Switch */}
            <div className={styles.dangerZone}>
                <h3 className={styles.sectionTitle}>Danger Zone</h3>
                <Button
                    variant="secondary"
                    className={styles.killSwitchButton}
                    onClick={() => {
                        if (confirm('Are you sure? This will disconnect ALL participants and end the session.')) {
                            killSwitch();
                        }
                    }}
                >
                    ⚠️ Kill Switch
                </Button>
            </div>

            <div className={styles.footer}>
                <div className={styles.copyright}>
                    <p>© 2025 Mahanama College Science Society. All rights reserved.</p>
                    <p className={styles.developer}>Developed by Hirosh Nividu • Fellow Mahanamian</p>
                </div>
            </div>
        </div>
    );
}
