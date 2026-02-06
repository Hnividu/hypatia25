'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    LeaderboardData,
} from './events';
import type {
    Participant,
    QuizSessionState,
    ScoreResult,
    QuestionForParticipant,
    QuestionStats,
} from '@/types/quiz';

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET.IO CLIENT
// React hooks for real-time quiz communication
// ═══════════════════════════════════════════════════════════════════════════════

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

/**
 * Initialize the socket connection
 */
function getSocket(): TypedSocket {
    if (!globalSocket) {
        globalSocket = io({
            path: '/api/socketio',
            addTrailingSlash: false,
        });
    }
    return globalSocket;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SOCKET HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseSocketOptions {
    sessionId?: string;
    isAdmin?: boolean;
}

export interface UseSocketReturn {
    socket: TypedSocket | null;
    connected: boolean;
    error: string | null;
    // Session state
    sessionState: QuizSessionState | null;
    participants: Participant[];
    // Question state
    currentQuestion: QuestionForParticipant | null;
    questionNumber: number;
    totalQuestions: number;
    timeRemaining: number;
    // Ready countdown state (3-2-1 before question)
    readyCountdown: number;
    upcomingQuestionNumber: number;
    // Section state
    sectionNumber: number;
    totalSections: number;
    // Answer state
    answerSubmitted: boolean;
    lastResult: ScoreResult | null;
    // Leaderboard
    leaderboard: LeaderboardData | null;
    // Admin Stats
    questionStats: QuestionStats | null;
    // Methods
    joinSession: (regId: string, sessionId: string, name: string) => Promise<{ success: boolean; error?: string }>;
    submitAnswer: (
        questionId: string,
        type: 'mcq' | 'categorize' | 'numerical',
        answer: unknown,
        timeTaken: number
    ) => Promise<boolean>;
    // Admin methods
    createSession: (quizId: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    startQuiz: () => void;
    nextQuestion: () => void;
    showLeaderboard: () => void;
    endQuiz: () => void;
    removeParticipant: (regId: string) => void;
    killSwitch: () => void;
    resetQuiz: () => void;
    getQuestionStats: (questionIndex: number) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
    const { sessionId, isAdmin = false } = options;

    const socketRef = useRef<TypedSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Session state
    const [sessionState, setSessionState] = useState<QuizSessionState | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);

    // Question state
    const [currentQuestion, setCurrentQuestion] = useState<QuestionForParticipant | null>(null);
    const [questionNumber, setQuestionNumber] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);

    // Ready countdown state (3-2-1 before question)
    const [readyCountdown, setReadyCountdown] = useState(0);
    const [upcomingQuestionNumber, setUpcomingQuestionNumber] = useState(0);
    const readyTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Section state
    const [sectionNumber, setSectionNumber] = useState(0);
    const [totalSections, setTotalSections] = useState(0);

    // Answer state
    const [answerSubmitted, setAnswerSubmitted] = useState(false);
    const [lastResult, setLastResult] = useState<ScoreResult | null>(null);

    // Leaderboard
    const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

    // Admin stats
    const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);

    // Initialize socket
    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        // Set initial connection state
        if (socket.connected) {
            setConnected(true);
            // If already connected and admin, join session immediately
            if (sessionId && isAdmin) {
                console.log(`[Admin] Socket already connected, joining session ${sessionId}`);
                socket.emit('admin:join-session', { sessionId });
            }
        }

        // Connection handlers
        socket.on('connect', () => {
            console.log('[Socket] Connected');
            setConnected(true);
            setError(null);

            // Join admin session after connection is established
            if (sessionId && isAdmin) {
                console.log(`[Admin] Joining session ${sessionId} on connect`);
                socket.emit('admin:join-session', { sessionId });
            }
        });

        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            setConnected(false);
        });

        socket.on('connected', ({ socketId }) => {
            console.log('[Socket] Server confirmed connection with ID:', socketId);
        });

        socket.on('error', (message) => {
            setError(message);
        });

        // Session state handlers
        socket.on('session:state', (state) => {
            setSessionState(state);
            setParticipants(state.participants);
        });

        socket.on('participant:joined', (participant) => {
            setParticipants((prev) => {
                const exists = prev.find((p) => p.regId === participant.regId);
                if (exists) return prev;
                return [...prev, participant];
            });
        });

        socket.on('participant:left', (regId) => {
            setParticipants((prev) => prev.filter((p) => p.regId !== regId));
        });

        socket.on('participants:list', (list) => {
            setParticipants(list);
        });

        // Question handlers
        socket.on('question:ready', ({ questionNumber: qNum, totalQuestions: total }) => {
            // Clear any existing ready timer
            if (readyTimerRef.current) {
                clearInterval(readyTimerRef.current);
            }

            setUpcomingQuestionNumber(qNum);
            setReadyCountdown(3);

            // Start local countdown 3-2-1
            let count = 3;
            readyTimerRef.current = setInterval(() => {
                count--;
                setReadyCountdown(count);
                if (count <= 0) {
                    if (readyTimerRef.current) {
                        clearInterval(readyTimerRef.current);
                        readyTimerRef.current = null;
                    }
                }
            }, 1000);
        });

        socket.on('question:show', ({ question, questionNumber: qNum, totalQuestions: total, sectionNumber: secNum, totalSections: secTotal, timeLimit }) => {
            console.log('[DEBUG CLIENT] question:show received:', {
                type: question?.type,
                itemType: question?.itemType,
                title: question?.title,
                timeLimit,
                qNum,
                total,
                secNum,
                secTotal
            });

            // Clear ready countdown when question shows
            if (readyTimerRef.current) {
                clearInterval(readyTimerRef.current);
                readyTimerRef.current = null;
            }
            setReadyCountdown(0);
            setUpcomingQuestionNumber(0);

            setCurrentQuestion(question);
            setQuestionNumber(qNum);
            setTotalQuestions(total);
            setSectionNumber(secNum || 0);
            setTotalSections(secTotal || 0);
            // timeLimit of -1 means section (no timer) - use a high value so timer doesn't expire
            setTimeRemaining(timeLimit === -1 ? 9999 : timeLimit);
            setAnswerSubmitted(false);
            setLastResult(null);

            // Clear stats on new question (will be updated by admin:question-stats)
            setQuestionStats(null);
        });

        socket.on('question:countdown', (seconds) => {
            setTimeRemaining(seconds);
        });

        socket.on('question:timeUp', () => {
            setTimeRemaining(0);
        });

        socket.on('question:ended', () => {
            setCurrentQuestion(null);
        });

        // Answer handlers
        socket.on('answer:received', () => {
            setAnswerSubmitted(true);
        });

        socket.on('answer:result', (result) => {
            setLastResult(result);
        });

        // Leaderboard handlers
        socket.on('leaderboard:update', (data) => {
            setLeaderboard(data);
        });

        socket.on('quiz:finished', (data) => {
            setLeaderboard(data);
            setCurrentQuestion(null);
        });

        // Admin stats
        socket.on('admin:question-stats', (stats) => {
            setQuestionStats(stats);
        });



        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connected');
            socket.off('error');
            socket.off('session:state');
            socket.off('participant:joined');
            socket.off('participant:left');
            socket.off('participants:list');
            socket.off('question:ready');
            socket.off('question:show');
            socket.off('question:countdown');
            socket.off('question:timeUp');
            socket.off('question:ended');
            socket.off('answer:received');
            socket.off('answer:result');
            socket.off('leaderboard:update');
            socket.off('quiz:finished');
            socket.off('admin:question-stats');

            if (readyTimerRef.current) {
                clearInterval(readyTimerRef.current);
            }
        };
    }, [sessionId, isAdmin]);

    // Local timer countdown
    useEffect(() => {
        if (!currentQuestion) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentQuestion]);

    // Join session (for participants)
    const joinSession = useCallback(
        async (regId: string, sid: string, name: string): Promise<{ success: boolean; error?: string }> => {
            return new Promise((resolve) => {
                if (!socketRef.current) {
                    resolve({ success: false, error: 'Socket not connected' });
                    return;
                }

                socketRef.current.emit(
                    'participant:join',
                    { regId, sessionId: sid, name },
                    (response) => {
                        resolve(response);
                    }
                );
            });
        },
        []
    );

    // Submit answer
    const submitAnswer = useCallback(
        async (
            questionId: string,
            type: 'mcq' | 'categorize' | 'numerical',
            answer: unknown,
            timeTaken: number
        ): Promise<boolean> => {
            return new Promise((resolve) => {
                if (!socketRef.current || !sessionId) {
                    resolve(false);
                    return;
                }

                socketRef.current.emit(
                    'answer:submit',
                    { sessionId, questionId, type, answer, timeTaken },
                    (response) => {
                        resolve(response.success);
                    }
                );
            });
        },
        [sessionId]
    );

    // Create session (admin)
    const createSession = useCallback(
        async (quizId: string): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
            return new Promise((resolve) => {
                if (!socketRef.current) {
                    resolve({ success: false, error: 'Socket not connected' });
                    return;
                }

                socketRef.current.emit('admin:create-session', quizId, (response) => {
                    resolve(response);
                });
            });
        },
        []
    );

    // Admin controls
    const startQuiz = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:start-quiz', sessionId);
        }
    }, [sessionId]);

    const nextQuestion = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:next-question', sessionId);
        }
    }, [sessionId]);

    const showLeaderboard = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:show-leaderboard', sessionId);
        }
    }, [sessionId]);

    const endQuiz = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:end-quiz', sessionId);
        }
    }, [sessionId]);

    const removeParticipant = useCallback((regId: string) => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:remove-participant', sessionId, regId);
        }
    }, [sessionId]);

    const killSwitch = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:kill-switch', sessionId);
        }
    }, [sessionId]);

    const resetQuiz = useCallback(() => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:reset-quiz', sessionId);
        }
    }, [sessionId]);

    const getQuestionStats = useCallback((questionIndex: number) => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit('admin:get-question-stats', { sessionId, questionIndex });
        }
    }, [sessionId]);

    return {
        socket: socketRef.current,
        connected,
        error,
        sessionState,
        participants,
        currentQuestion,
        questionNumber,
        totalQuestions,
        timeRemaining,
        readyCountdown,
        upcomingQuestionNumber,
        sectionNumber,
        totalSections,
        answerSubmitted,
        lastResult,
        leaderboard,
        questionStats,
        joinSession,
        submitAnswer,
        createSession,
        startQuiz,
        nextQuestion,
        showLeaderboard,
        endQuiz,
        removeParticipant,
        killSwitch,
        resetQuiz,
        getQuestionStats,
    };
}
