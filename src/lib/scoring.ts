import type {
    Question,
    Answer,
    MCQQuestion,
    MCQAnswer,
    CategorizeQuestion,
    CategorizeAnswer,
    NumericalQuestion,
    NumericalAnswer,
    ScoreResult,
} from '@/types/quiz';

// ═══════════════════════════════════════════════════════════════════════════════
// TIME-WEIGHTED SCORING ALGORITHM
// ═══════════════════════════════════════════════════════════════════════════════
//
// Score Formula: totalPoints = basePoints * (1 + speedBonus)
// 
// Where:
// - basePoints = 1000 (correct answer), 0 (incorrect)
// - speedBonus = (timeLimit - timeTaken) / timeLimit * 0.5
//   Max speed bonus is 50% (answering instantly)
//   No penalty for slow answers (minimum bonus is 0%)
// - doublePoints applies 2x multiplier to final score
//
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_POINTS = 1000;
const MAX_SPEED_BONUS = 0.5; // 50% bonus for instant answers

/**
 * Calculate score for an answer
 */
export function calculateScore(
    question: Question,
    answer: Answer,
    timeLimitMs: number
): ScoreResult {
    let isCorrect = checkAnswer(question, answer);

    if (!isCorrect) {
        return {
            participantId: answer.participantId,
            questionId: answer.questionId,
            correct: false,
            basePoints: 0,
            speedBonus: 0,
            totalPoints: 0,
            timeTaken: answer.timeTaken,
        };
    }

    // Calculate speed bonus based on time taken
    const timeRatio = Math.max(0, (timeLimitMs - answer.timeTaken) / timeLimitMs);
    let speedBonus = Math.round(BASE_POINTS * timeRatio * MAX_SPEED_BONUS);
    let basePoints = BASE_POINTS;

    // Handle Partial Credit for Categorize Questions
    if (question.type === 'categorize' && answer.type === 'categorize') {
        const accuracy = getCategorizeScoreMultiplier(question, answer);

        // Adjust points by accuracy
        basePoints = Math.round(basePoints * accuracy);
        speedBonus = Math.round(speedBonus * accuracy);

        // If accuracy is 0, return early as incorrect
        if (accuracy === 0) {
            return {
                participantId: answer.participantId,
                questionId: answer.questionId,
                correct: false,
                basePoints: 0,
                speedBonus: 0,
                totalPoints: 0,
                timeTaken: answer.timeTaken,
            };
        }
        // Proceed with reduced points. 
        // Note: isCorrect is usually boolean. We'll set it to true if > 0 points, 
        // or we could enforce 100% for "correct".
        // Let's explicitly check 100% for the "correct" flag but award points regardless.
        isCorrect = accuracy === 1;
    }

    let totalPoints = basePoints + speedBonus;

    // Apply double points if enabled
    if (question.doublePoints) {
        totalPoints *= 2;
    }

    return {
        participantId: answer.participantId,
        questionId: answer.questionId,
        correct: isCorrect,
        basePoints: question.doublePoints ? BASE_POINTS * 2 : BASE_POINTS,
        speedBonus: question.doublePoints ? speedBonus * 2 : speedBonus,
        totalPoints,
        timeTaken: answer.timeTaken,
    };
}

/**
 * Check if an answer is correct
 */
export function checkAnswer(question: Question, answer: Answer): boolean {
    switch (question.type) {
        case 'mcq':
            return checkMCQAnswer(question, answer as MCQAnswer);
        case 'categorize':
            // For boolean check, strict 100% required
            return getCategorizeScoreMultiplier(question, answer as CategorizeAnswer) === 1;
        case 'numerical':
            return checkNumericalAnswer(question, answer as NumericalAnswer);
        default:
            return false;
    }
}

/**
 * Check MCQ answer
 */
function checkMCQAnswer(question: MCQQuestion, answer: MCQAnswer): boolean {
    const correctOption = question.options.find((opt) => opt.isCorrect);
    return correctOption?.id === answer.selectedOptionId;
}

/**
 * Check categorization answer with PARTIAL CREDIT support
 * Returns a score multiplier between 0 and 1
 */
function getCategorizeScoreMultiplier(
    question: CategorizeQuestion,
    answer: CategorizeAnswer
): number {
    // Create a map of correct placements: itemId -> categoryId
    const correctPlacements = new Map(
        question.items.map((item) => [item.id, item.categoryId])
    );

    let correctCount = 0;
    const totalItems = question.items.length;

    if (totalItems === 0) return 0;

    // Check each placement in the answer
    for (const placement of answer.placements) {
        const correctCategory = correctPlacements.get(placement.itemId);
        // Robust check: trim strings if needed, though IDs should be strict
        if (correctCategory && placement.categoryId && correctCategory.trim() === placement.categoryId.trim()) {
            correctCount++;
        }
    }

    return correctCount / totalItems;
}

/**
 * Check numerical answer with tolerance
 */
function checkNumericalAnswer(
    question: NumericalQuestion,
    answer: NumericalAnswer
): boolean {
    const answerValue = Number(answer.value);
    if (isNaN(answerValue)) return false;

    const diff = Math.abs(question.correctAnswer - answerValue);
    return diff <= question.tolerance;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    rank: number;
    participantId: string;
    participantName: string;
    totalScore: number;
    correctAnswers: number;
    totalQuestions: number;
    averageTime: number;
}

/**
 * Calculate leaderboard from all scores
 */
export function calculateLeaderboard(
    participantScores: Map<string, { name: string; scores: ScoreResult[] }>
): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    for (const [participantId, data] of participantScores) {
        const totalScore = data.scores.reduce((sum, s) => sum + s.totalPoints, 0);
        const correctAnswers = data.scores.filter((s) => s.correct).length;
        const totalTime = data.scores.reduce((sum, s) => sum + s.timeTaken, 0);
        const averageTime = data.scores.length > 0 ? totalTime / data.scores.length : 0;

        entries.push({
            rank: 0, // Will be set after sorting
            participantId,
            participantName: data.name,
            totalScore,
            correctAnswers,
            totalQuestions: data.scores.length,
            averageTime,
        });
    }

    // Sort by score (descending)
    // Removed AverageTime tie-breaker as per new "Standard Competition Ranking" request
    entries.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks with Standard Competition Ranking (1224)
    // Ties get the same rank, next rank is skipped
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
        if (i > 0 && entries[i].totalScore === entries[i - 1].totalScore) {
            // Same score as previous, same rank
            entries[i].rank = entries[i - 1].rank;
        } else {
            // New score, rank is current position (1-based)
            entries[i].rank = i + 1;
        }
    }

    return entries;
}

/**
 * Format time in milliseconds to a readable string
 */
export function formatTime(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
}

/**
 * Format score with commas
 */
export function formatScore(score: number): string {
    return score.toLocaleString();
}
