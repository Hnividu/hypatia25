'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Lobby from '@/components/participant/Lobby';
import QuestionView from '@/components/participant/QuestionView';
import LeaderboardView from '@/components/participant/LeaderboardView';
import InterstitialView from '@/components/participant/InterstitialView';
import QuestionReadyView from '@/components/participant/QuestionReadyView';
import WaitingView from '@/components/participant/WaitingView';
import QuizEndedView from '@/components/participant/QuizEndedView';
import SectionCardView from '@/components/participant/SectionCardView';
import styles from './styles.module.css';
import { useSocket } from '@/lib/socket/client';

interface StoredParticipant {
    regId: string;
    name: string;
    validatedAt: number;
}

export default function PlayPage({ params }: { params: Promise<{ quizCode: string }> }) {
    const { quizCode } = use(params);
    const router = useRouter();

    // Get participant info from sessionStorage (secure, validated on join page)
    const [participant, setParticipant] = useState<StoredParticipant | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load participant from sessionStorage on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('hypatia_participant');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as StoredParticipant;
                // Check if validated within last 24 hours
                const validDuration = 24 * 60 * 60 * 1000; // 24 hours
                if (Date.now() - parsed.validatedAt < validDuration) {
                    setParticipant(parsed);
                } else {
                    // Expired, redirect to join page
                    sessionStorage.removeItem('hypatia_participant');
                    router.push('/');
                    return;
                }
            } catch {
                router.push('/');
                return;
            }
        } else {
            router.push('/');
            return;
        }
        setIsLoading(false);
    }, [router]);

    const regId = participant?.regId;
    const name = participant?.name;

    const {
        socket,
        connected,
        participants,
        joinSession,
        sessionState,
        currentQuestion,
        questionNumber,
        totalQuestions,
        timeRemaining,
        readyCountdown,
        upcomingQuestionNumber,
        sectionNumber,
        totalSections,
        submitAnswer,
        answerSubmitted,
        leaderboard,
    } = useSocket({ sessionId: quizCode });

    const [hasJoined, setHasJoined] = useState(false);

    useEffect(() => {
        if (!regId || !name) {
            return;
        }

        if (connected && !hasJoined) {
            joinSession(regId, quizCode, name).then((result) => {
                if (result.success) {
                    console.log('Joined session successfully');
                    setHasJoined(true);
                } else {
                    console.error('Failed to join session:', result.error);
                    alert(result.error || 'Failed to join session');
                    router.push('/');
                }
            });
        }
    }, [regId, name, connected, hasJoined, joinSession, quizCode]);

    const handleAnswerSubmit = async (answerValue: any) => {
        if (!currentQuestion || currentQuestion.type === 'section') return;

        await submitAnswer(
            currentQuestion.id,
            currentQuestion.type as 'mcq' | 'categorize' | 'numerical',
            answerValue,
            timeRemaining
        );
    };

    // Show loading while checking sessionStorage
    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <h1>Loading...</h1>
                </div>
            </div>
        );
    }

    if (!regId || !name) {
        return null;
    }

    if (!connected) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <h1>Connecting to server...</h1>
                </div>
            </div>
        );
    }

    const status = sessionState?.status || 'lobby';

    // RENDER LOGIC

    if (status === 'lobby') {
        return (
            <Lobby
                quizTitle={sessionState?.quizTitle || "Hypatia Quiz"}
                sessionCode={quizCode}
                participants={participants}
                isAdmin={false}
                currentUserId={regId}
            />
        );
    }

    // Show countdown before questions (but NOT sections - server doesn't send countdown for sections)
    // We only need to check readyCountdown > 0 because server only emits question:ready for actual questions
    if (status === 'countdown' && readyCountdown > 0) {
        return (
            <QuestionReadyView
                questionNumber={upcomingQuestionNumber}
                totalQuestions={sessionState?.totalQuestions || 0}
                countdown={readyCountdown}
            />
        );
    }

    if (status === 'question' || status === 'answer_reveal') {
        // If time is up (and not in answer_reveal which might show results later), show waiting
        // Actually, if status is question but timeRemaining is 0, it means we are waiting for server to transition

        if (!currentQuestion) {
            return <InterstitialView heading="Loading..." />;
        }

        console.log('[DEBUG PlayPage] Rendering for question type:', currentQuestion.type, 'question:', currentQuestion);

        // Check for Section type FIRST, as it has 0 timeLimit which would trigger WaitingView otherwise
        if (currentQuestion.type === 'section') {
            console.log('[DEBUG PlayPage] Rendering SectionCardView for:', currentQuestion.title, 'section:', sectionNumber);
            return (
                <SectionCardView
                    title={currentQuestion.title}
                    content={currentQuestion.content}
                    sectionNumber={sectionNumber}
                    totalSections={totalSections}
                />
            );
        }

        // If time is up (and not in answer_reveal which might show results later), show waiting
        // Actually, if status is question but timeRemaining is 0, it means we are waiting for server to transition
        if (timeRemaining === 0) {
            return (
                <WaitingView
                    title="Time's Up!"
                    message="Waiting for the next question..."
                    icon="⏰"
                />
            );
        }

        // If submitted, show waiting
        if (answerSubmitted) {
            return (
                <WaitingView
                    title="Answer Submitted"
                    message="Sit tight! Waiting for others to finish..."
                    icon="✅"
                />
            );
        }

        return (
            <QuestionView
                question={currentQuestion}
                questionNumber={questionNumber}
                totalQuestions={totalQuestions}
                timeRemaining={timeRemaining}
                onSubmit={handleAnswerSubmit}
                submitted={answerSubmitted}
            />
        );
    }

    if (status === 'leaderboard') {
        return (
            <LeaderboardView
                data={leaderboard}
                currentUserId={regId}
            />
        );
    }

    if (status === 'finished') {
        return <QuizEndedView />;
    }

    return <div className={styles.container}>Unknown state: {status}</div>;
}
