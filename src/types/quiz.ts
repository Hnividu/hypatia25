// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ SYSTEM TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Question Types
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionType = 'mcq' | 'categorize' | 'numerical';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  timeLimit: number; // in seconds
  doublePoints: boolean;
  order: number;
  imageUrl?: string; // Base64 or URL
}

export interface SectionCard {
  id: string;
  quizId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MCQQuestion extends BaseQuestion {
  type: 'mcq';
  options: MCQOption[];
}

export interface Category {
  id: string;
  name: string;
  items: string[];
}

export interface CategorizeQuestion extends BaseQuestion {
  type: 'categorize';
  categories: Category[];
  items: { id: string; text: string; categoryId: string }[];
}

export interface NumericalQuestion extends BaseQuestion {
  type: 'numerical';
  correctAnswer: number;
  tolerance: number; // Acceptable range (+/-)
  unit?: string;
}

export type Question = MCQQuestion | CategorizeQuestion | NumericalQuestion;

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
}

// ─────────────────────────────────────────────────────────────────────────────
// Participant
// ─────────────────────────────────────────────────────────────────────────────

export interface Participant {
  regId: string;
  name: string;
  socketId?: string;
  joinedAt: string;
  connected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer Submissions
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseAnswer {
  participantId: string;
  questionId: string;
  submittedAt: number; // timestamp
  timeTaken: number; // in milliseconds
}

export interface MCQAnswer extends BaseAnswer {
  type: 'mcq';
  selectedOptionId: string;
}

export interface CategorizeAnswer extends BaseAnswer {
  type: 'categorize';
  placements: { itemId: string; categoryId: string }[];
}

export interface NumericalAnswer extends BaseAnswer {
  type: 'numerical';
  value: number;
}

export type Answer = MCQAnswer | CategorizeAnswer | NumericalAnswer;

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreResult {
  participantId: string;
  questionId: string;
  correct: boolean;
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  timeTaken: number;
}

export interface ParticipantScore {
  participant: Participant;
  totalScore: number;
  correctAnswers: number;
  totalQuestions: number;
  questionScores: ScoreResult[];
}

export interface Leaderboard {
  rankings: ParticipantScore[];
  lastUpdated: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz Session State
// ─────────────────────────────────────────────────────────────────────────────

export type QuizSessionStatus =
  | 'lobby'
  | 'countdown'
  | 'question'
  | 'answer_reveal'
  | 'leaderboard'
  | 'finished';

export interface QuizSession {
  id: string;
  quizId: string;
  quiz: Quiz;
  status: QuizSessionStatus;
  items: QuizItem[]; // Interleaved questions and sections
  currentQuestionIndex: number;
  participants: Map<string, Participant>;
  answers: Map<string, Answer[]>;
  scores: Map<string, ParticipantScore>;
  startedAt?: number;
  questionStartedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket Events
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'session:state': (session: QuizSessionState) => void;
  'participant:joined': (participant: Participant) => void;
  'participant:left': (regId: string) => void;
  'quiz:start': () => void;
  'question:show': (question: QuestionForParticipant, questionNumber: number, totalQuestions: number) => void;
  'question:countdown': (secondsRemaining: number) => void;
  'question:end': () => void;
  'answer:result': (result: ScoreResult) => void;
  'leaderboard:update': (leaderboard: Leaderboard) => void;
  'quiz:finished': (finalLeaderboard: Leaderboard) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'participant:join': (data: { regId: string; sessionId: string; name: string }) => void;
  'answer:submit': (answer: Answer) => void;
  'admin:start': (sessionId: string) => void;
  'admin:next': (sessionId: string) => void;
  'admin:show-leaderboard': (sessionId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────────────────────

// Question without correct answers (for participants)
export type QuestionForParticipant =
  | (Omit<MCQQuestion, 'options'> & {
    options: Omit<MCQOption, 'isCorrect'>[];
    itemType: 'question';
    title?: string;
  })
  | (Omit<CategorizeQuestion, 'items'> & {
    categories: { id: string; name: string }[];
    items: { id: string; text: string }[];
    itemType: 'question';
    title?: string;
  })
  | (Omit<NumericalQuestion, 'correctAnswer' | 'tolerance'> & {
    itemType: 'question';
    title?: string;
  })
  | (SectionCard & {
    type: 'section';
    itemType: 'section';
  });

export type QuizItem =
  | (Question & { itemType: 'question' })
  | (SectionCard & { itemType: 'section' });

// Serializable session state for client
export interface QuizSessionState {
  id: string;
  quizId: string;
  quizTitle: string;
  status: QuizSessionStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  participants: Participant[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface ParticipantQuestionStat {
  regId: string;
  name: string;
  hasAnswered: boolean;
  answer?: any;
  isCorrect?: boolean;
  timeTaken?: number;
  points?: number;
  speedBonus?: number;
}

export interface QuestionStats {
  questionId: string;
  questionIndex: number;
  questionText: string;
  questionType: QuestionType;
  // Metadata for rendering answers
  options?: { id: string; text: string }[];
  categories?: { id: string; name: string }[];
  items?: { id: string; text: string }[];
  stats: ParticipantQuestionStat[];
}

