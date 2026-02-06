// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET.IO EVENT DEFINITIONS
// Type-safe event definitions for real-time communication
// ═══════════════════════════════════════════════════════════════════════════════

import type {
    Participant,
    QuizSessionState,
    ScoreResult,
    QuestionForParticipant,
    QuestionStats,
} from '@/types/quiz';

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardData {
    rankings: {
        rank: number;
        participantId: string;
        participantName: string;
        totalScore: number;
        correctAnswers: number;
    }[];
    lastUpdated: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER TO CLIENT EVENTS
// Events emitted by server to clients
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerToClientEvents {
    // Session state updates
    'session:state': (session: QuizSessionState) => void;

    // Participant events
    'participant:joined': (participant: Participant) => void;
    'participant:left': (regId: string) => void;
    'participants:list': (participants: Participant[]) => void;

    // Quiz flow events
    'quiz:starting': (countdown: number) => void;
    'quiz:started': () => void;
    'quiz:finished': (leaderboard: LeaderboardData) => void;

    // Question events
    'question:ready': (data: { questionNumber: number; totalQuestions: number; doublePoints: boolean }) => void;
    'question:show': (data: {
        question: QuestionForParticipant;
        questionNumber: number;
        totalQuestions: number;
        sectionNumber: number;
        totalSections: number;
        timeLimit: number;
    }) => void;
    'question:countdown': (secondsRemaining: number) => void;
    'question:timeUp': () => void;
    'question:ended': () => void;

    // Answer feedback
    'answer:received': () => void;
    'answer:result': (result: ScoreResult) => void;

    // Leaderboard (admin only)
    'leaderboard:update': (leaderboard: LeaderboardData) => void;

    // Error handling
    'error': (message: string) => void;

    // Connection
    'connected': (data: { socketId: string }) => void;

    // Admin-triggered events
    'session:killed': (reason: string) => void;
    'participant:kicked': (reason: string) => void;

    // Admin stats
    'admin:question-stats': (stats: QuestionStats) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT TO SERVER EVENTS
// Events emitted by clients to server
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientToServerEvents {
    // Participant actions
    'participant:join': (
        data: { regId: string; sessionId: string; name: string },
        callback: (response: { success: boolean; error?: string; participant?: Participant }) => void
    ) => void;
    'participant:leave': (sessionId: string) => void;

    // Answer submission
    'answer:submit': (
        data: {
            sessionId: string;
            questionId: string;
            type: 'mcq' | 'categorize' | 'numerical';
            answer: unknown;
            timeTaken: number;
        },
        callback: (response: { success: boolean; received: boolean }) => void
    ) => void;

    // Admin actions
    'admin:create-session': (
        quizId: string,
        callback: (response: { success: boolean; sessionId?: string; error?: string }) => void
    ) => void;
    'admin:join-session': (data: { sessionId: string; token?: string }) => void;
    'admin:start-quiz': (sessionId: string) => void;
    'admin:next-question': (sessionId: string) => void;
    'admin:show-leaderboard': (sessionId: string) => void;
    'admin:end-quiz': (sessionId: string) => void;
    'admin:remove-participant': (sessionId: string, regId: string) => void;
    'admin:kill-switch': (sessionId: string) => void;
    'admin:reset-quiz': (sessionId: string) => void;
    'admin:request-stats': (sessionId: string) => void;
    'admin:get-question-stats': (data: { sessionId: string; questionIndex: number }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTER-SERVER EVENTS
// Events between server instances (if using multiple servers)
// ─────────────────────────────────────────────────────────────────────────────

export interface InterServerEvents {
    ping: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET DATA
// Data attached to each socket
// ─────────────────────────────────────────────────────────────────────────────

export interface SocketData {
    regId?: string;
    participantName?: string;
    sessionId?: string;
    isAdmin?: boolean;
}
