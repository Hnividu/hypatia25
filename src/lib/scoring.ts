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
// New Score Formula:
// totalPoints = (1 - (timeTaken / (timeLimit * 2))) * BASE_POINTS
// 
// Where:
// - BASE_POINTS = 1000
// - This results in a linear decay:
//   - Instant answer (0s): 1000 points
//   - Last second answer (timeLimit): 500 points
//
// - doublePoints applies 2x multiplier to final score
//
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_REFERENCE = 1000;

/**
 * Calculate score for an answer
 */
export function calculateScore(
    question: Question,
    answer: Answer,
    timeLimitMs: number
): ScoreResult {
    // 1. Calculate Accuracy (0 to 1)
    let accuracy = 0;

    if (question.type === 'categorize' && answer.type === 'categorize') {
        accuracy = getCategorizeScoreMultiplier(question, answer);
    } else {
        // Use strict check for others (MCQ, Numerical)
        const isCorrect = checkAnswer(question, answer);
        accuracy = isCorrect ? 1 : 0;
    }

    // 2. Return early if incorrect (0 accuracy)
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

    // 3. Apply Scoring Formula
    // Formula: (1 - (Response time / (total time x 2))) x (base_points)

    // Ensure we don't divide by zero
    const denominator = timeLimitMs * 2;
    const timeFactor = denominator > 0 ? (1 - (answer.timeTaken / denominator)) : 1;

    // Calculate raw points based on formula and accuracy (partial credit)
    let totalPoints = Math.round(BASE_REFERENCE * timeFactor * accuracy);

    // 4. Double Points Multiplier
    if (question.doublePoints) {
        totalPoints *= 2;
    }

    // 5. Decomposition for UI (Base + Bonus)
    // We define "Base Points" as the minimum score for a correct answer (at timeLimit)
    // At t = timeLimit, the factor is (1 - 0.5) = 0.5
    // So Base = 500 * accuracy [ * 2 if double ]
    let basePoints = Math.round(500 * accuracy);
    if (question.doublePoints) {
        basePoints *= 2;
    }

    // The rest is considered "Speed Bonus"
    const speedBonus = Math.max(0, totalPoints - basePoints);

    return {
        participantId: answer.participantId,
        questionId: answer.questionId,
        correct: accuracy === 1, // Strict correctness flag
        basePoints,
        speedBonus,
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
