import { google } from 'googleapis';

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize the Google Sheets API client
function getGoogleSheetsClient() {
    let credentials: { client_email: string; private_key: string };

    // Check if we have a full JSON key or separate fields
    let privateKeyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';

    // Remove wrapping quotes if present (common in .env files)
    if ((privateKeyEnv.startsWith('"') && privateKeyEnv.endsWith('"')) ||
        (privateKeyEnv.startsWith("'") && privateKeyEnv.endsWith("'"))) {
        privateKeyEnv = privateKeyEnv.slice(1, -1);
    }

    if (privateKeyEnv.startsWith('{')) {
        // Full JSON service account key
        try {
            const parsed = JSON.parse(privateKeyEnv);
            credentials = {
                client_email: parsed.client_email,
                private_key: parsed.private_key,
            };
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY as JSON:', e);
            // Return empty credentials - will fail gracefully
            credentials = { client_email: '', private_key: '' };
        }
    } else {
        // Separate fields
        credentials = {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
            private_key: privateKeyEnv.replace(/\\n/g, '\n'),
        };
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1SJwV_yiJWTfY26HNGBAElw3XfxA6C7aazbMwG5TzdNA';

// Sheet names - matching user's Google Sheet structure
const SHEETS = {
    REGISTRATIONS: 'Registrations',  // Existing sheet with participant data
    QUESTIONS: 'Questions',          // Sheet for quiz questions
    LEADERBOARD: 'Leaderboard',      // Sheet for leaderboard data
    QUIZ: 'Quiz',                    // Sheet for quiz metadata (single row)
    RESPONSES: 'Responses',          // Sheet for per-question response data
    SECTION_CARDS: 'SectionCards',   // Sheet for section divider cards
} as const;

// Fixed quiz ID for the single quiz system
export const MAIN_QUIZ_ID = 'hypatia25';

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN MAPPINGS FOR REGISTRATIONS SHEET
// Based on user's spreadsheet:
// A: Timestamp
// B: Reg ID
// C: School Name
// D: Society Email
// E: Leader Name
// F: Leader DOB
// G: Leader WhatsApp
// H-I: Member 1 (Name, DOB)
// J-K: Member 2 (Name, DOB)
// L-M: Member 3 (Name, DOB)
// N: President Name
// O: President Contact
// P: MIC Name
// Q: MIC Contact
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANT FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ParticipantData {
    regId: string;
    name: string;           // Leader Name
    schoolName: string;
    email: string;          // Society Email
    leaderWhatsApp?: string;
    members: {
        name: string;
        dob?: string;
    }[];
}

/**
 * Validate a participant's Reg_ID and return their information
 */
export async function validateParticipant(regId: string): Promise<ParticipantData | null> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.REGISTRATIONS}!A:Q`, // Get all columns
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return null;
        }

        // Find participant by Reg_ID (column B, index 1)
        const participantRow = rows.find(
            (row, index) => index > 0 && row[1]?.toString().trim().toLowerCase() === regId.trim().toLowerCase()
        );

        if (!participantRow) {
            return null;
        }

        // Build members array
        const members = [];
        // Member 1: columns H-I (index 7-8)
        if (participantRow[7]) {
            members.push({ name: participantRow[7], dob: participantRow[8] });
        }
        // Member 2: columns J-K (index 9-10)
        if (participantRow[9]) {
            members.push({ name: participantRow[9], dob: participantRow[10] });
        }
        // Member 3: columns L-M (index 11-12)
        if (participantRow[11]) {
            members.push({ name: participantRow[11], dob: participantRow[12] });
        }

        return {
            regId: participantRow[1] || '',
            name: participantRow[4] || 'Unknown',           // Leader Name (column E)
            schoolName: participantRow[2] || '',            // School Name (column C)
            email: participantRow[3] || '',                 // Society Email (column D)
            leaderWhatsApp: participantRow[6] || undefined, // Leader WhatsApp (column G)
            members,
        };
    } catch (error) {
        console.error('Error validating participant:', error);
        throw error;
    }
}


/**
 * Get participant name by Reg ID (quick lookup for display)
 */
export async function getParticipantName(regId: string): Promise<string | null> {
    const participant = await validateParticipant(regId);
    return participant?.name || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ METADATA FUNCTIONS
// Quiz sheet structure:
// A: Name
// B: Description
// C: UpdatedAt
// ─────────────────────────────────────────────────────────────────────────────

export interface QuizMetadata {
    name: string;
    description: string;
    updatedAt?: string;
}

/**
 * Ensure the Quiz sheet exists, create it if it doesn't
 */
async function ensureQuizSheetExists(): Promise<void> {
    const sheets = getGoogleSheetsClient();

    // Try to get the sheet metadata to check if it exists
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const quizSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEETS.QUIZ
    );

    if (!quizSheet) {
        // Create the Quiz sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: SHEETS.QUIZ,
                            },
                        },
                    },
                ],
            },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUIZ}!A1:C1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['Name', 'Description', 'UpdatedAt']],
            },
        });

        // Add default quiz data
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUIZ}!A2:C2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['Untitled Quiz', '', new Date().toISOString()]],
            },
        });
    }
}

/**
 * Ensure the Questions sheet exists, create it if it doesn't
 */
async function ensureQuestionsSheetExists(): Promise<void> {
    const sheets = getGoogleSheetsClient();

    // Try to get the sheet metadata to check if it exists
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const questionsSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEETS.QUESTIONS
    );

    if (!questionsSheet) {
        // Create the Questions sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: SHEETS.QUESTIONS,
                            },
                        },
                    },
                ],
            },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A1:J1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['ID', 'QuizId', 'Type', 'Text', 'Order', 'TimeLimit', 'DoublePoints', 'Data', 'CreatedAt', 'ImageUrl']],
            },
        });
    } else {
        // Check if headers exist
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A1:I1`,
        });

        if (!headerResponse.data.values || headerResponse.data.values.length === 0 || !headerResponse.data.values[0][0]) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.QUESTIONS}!A1:J1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['ID', 'QuizId', 'Type', 'Text', 'Order', 'TimeLimit', 'DoublePoints', 'Data', 'CreatedAt', 'ImageUrl']],
                },
            });
        }
    }
}

/**
 * Ensure the Leaderboard sheet exists, create it if it doesn't
 */
async function ensureLeaderboardSheetExists(): Promise<void> {
    const sheets = getGoogleSheetsClient();

    // Try to get the sheet metadata to check if it exists
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const leaderboardSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEETS.LEADERBOARD
    );

    if (!leaderboardSheet) {
        // Create the Leaderboard sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: SHEETS.LEADERBOARD,
                            },
                        },
                    },
                ],
            },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.LEADERBOARD}!A1:F1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['RegId', 'Name', 'Score', 'CorrectAnswers', 'TotalQuestions', 'CompletedAt']],
            },
        });
    } else {
        // Check if headers exist
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.LEADERBOARD}!A1:F1`,
        });

        if (!headerResponse.data.values || headerResponse.data.values.length === 0 || !headerResponse.data.values[0][0]) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.LEADERBOARD}!A1:F1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [['RegId', 'Name', 'Score', 'CorrectAnswers', 'TotalQuestions', 'CompletedAt']],
                },
            });
        }
    }
}

/**
 * Get the single quiz metadata
 */
export async function getQuiz(): Promise<QuizMetadata> {
    // Ensure the sheet exists first
    await ensureQuizSheetExists();

    // Log available sheets for debugging
    const allSheets = await listSheets().catch(e => []);
    console.log('[Sheets Debug] Available sheets:', allSheets);

    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.QUIZ}!A2:C2`,
    });

    const row = response.data.values?.[0];
    if (!row) {
        return { name: 'Untitled Quiz', description: '' };
    }

    return {
        name: row[0] || 'Untitled Quiz',
        description: row[1] || '',
        updatedAt: row[2] || '',
    };
}

/**
 * Save/update the single quiz metadata
 */
export async function saveQuiz(name: string, description: string): Promise<void> {
    try {
        // Ensure the sheet exists first
        await ensureQuizSheetExists();

        const sheets = getGoogleSheetsClient();
        const now = new Date().toISOString();

        // Update the quiz data (always row 2)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUIZ}!A2:C2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[name, description, now]],
            },
        });
    } catch (error) {
        console.error('Error saving quiz:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION FUNCTIONS
// Questions sheet structure:
// A: ID
// B: QuizId
// C: Type (mcq/categorize/numerical)
// D: Text (question text)
// E: Order
// F: TimeLimit (seconds)
// G: DoublePoints (TRUE/FALSE)
// H: Data (JSON string with options, correct answer, etc.)
// I: CreatedAt
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionData {
    id: string;
    quizId: string;
    type: 'mcq' | 'categorize' | 'numerical';
    text: string;
    order: number;
    timeLimit: number;
    doublePoints: boolean;
    data: string; // JSON stringified question-specific data
    createdAt?: string;
    imageUrl?: string;
}

// For MCQ questions
export interface MCQData {
    options: { id: string; text: string }[];
    correctOptionId: string;
}

// For Categorization questions
export interface CategorizeData {
    categories: { id: string; name: string }[];
    items: { id: string; text: string; categoryId: string }[];
}

// For Numerical questions
export interface NumericalData {
    correctAnswer: number;
    tolerance: number;
}

/**
 * Get all questions for a quiz
 */
export async function getQuestionsByQuizId(quizId: string): Promise<QuestionData[]> {
    try {
        // Ensure the sheet exists first
        await ensureQuestionsSheetExists();

        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A:J`,
        });

        const rows = response.data.values;
        console.log(`[Sheets Debug] Fetched ${rows?.length || 0} rows from Questions sheet`);

        if (rows && rows.length > 0) {
            console.log('[Sheets Debug] Header row:', rows[0]);
            if (rows.length > 1) {
                console.log('[Sheets Debug] First data row:', rows[1]);
                console.log('[Sheets Debug] Row[1] (QuizId) type:', typeof rows[1][1], 'Value:', rows[1][1]);
                console.log('[Sheets Debug] Expected QuizId:', quizId);
            }
        }

        if (!rows || rows.length <= 1) {
            return [];
        }

        const filtered = rows
            .slice(1)
            .filter((row) => {
                const rowQuizId = row[1]?.toString().trim().toLowerCase();
                const targetQuizId = quizId.trim().toLowerCase();
                const match = rowQuizId === targetQuizId;
                if (!match && row[0]) {
                    console.log(`[Sheets Debug] Row skipped. ID: ${row[0]}, QuizId: ${row[1]} (Expected: ${quizId})`);
                }
                return match && row[0];
            });

        console.log(`[Sheets Debug] Returning ${filtered.length} questions after filter`);

        return filtered
            .map((row) => ({
                id: row[0] || '',
                quizId: row[1] || '',
                type: (row[2] || 'mcq') as 'mcq' | 'categorize' | 'numerical',
                text: row[3] || '',
                order: parseInt(row[4], 10) || 0,
                timeLimit: parseInt(row[5], 10) || 30,
                doublePoints: row[6]?.toString().toLowerCase() === 'true',
                data: row[7] || '{}',
                createdAt: row[8] || '',
                imageUrl: row[9] || '',
            }))
            .sort((a, b) => a.order - b.order);
    } catch (error) {
        console.error('Error getting questions:', error);
        throw error;
    }
}

/**
 * List all sheet titles for debugging
 */
export async function listSheets(): Promise<string[]> {
    try {
        const sheets = getGoogleSheetsClient();
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        return response.data.sheets?.map(s => s.properties?.title || 'Unknown') || [];
    } catch (error) {
        console.error('Error listing sheets:', error);
        return [];
    }
}

/**
 * Get all quizzes (unique quiz IDs from questions)
 */
export async function getQuizzes(): Promise<{ id: string; title: string; questionCount: number }[]> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A:I`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return [];
        }

        // Group by quizId
        const quizMap = new Map<string, { id: string; title: string; count: number }>();

        rows.slice(1).forEach((row) => {
            const quizId = row[1];
            if (quizId) {
                const existing = quizMap.get(quizId);
                if (existing) {
                    existing.count++;
                } else {
                    // Use first question's text prefix as title or quiz ID
                    quizMap.set(quizId, {
                        id: quizId,
                        title: quizId, // Quiz ID serves as title
                        count: 1,
                    });
                }
            }
        });

        return Array.from(quizMap.values()).map((q) => ({
            id: q.id,
            title: q.title,
            questionCount: q.count,
        }));
    } catch (error) {
        console.error('Error getting quizzes:', error);
        throw error;
    }
}

/**
 * Create a new question
 */
// Creating a question in Google Sheets
export async function createQuestion(question: QuestionData): Promise<void> {
    try {
        // Ensure the sheet exists first
        await ensureQuestionsSheetExists();

        const sheets = getGoogleSheetsClient();
        const now = new Date().toISOString();

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A:J`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    question.id,
                    question.quizId,
                    question.type,
                    question.text,
                    question.order,
                    question.timeLimit,
                    question.doublePoints,
                    question.data,
                    now,
                    question.imageUrl || '',
                ]],
            },
        });
    } catch (error) {
        console.error('Error creating question:', error);
        throw error;
    }
}

/**
 * Update a question
 */
export async function updateQuestion(questionId: string, updates: Partial<QuestionData>): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A:A`,
        });

        const rows = response.data.values;
        if (!rows) return;

        const rowIndex = rows.findIndex((row) => row[0] === questionId);
        if (rowIndex === -1) return;

        const currentResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A${rowIndex + 1}:J${rowIndex + 1}`,
        });

        const currentRow = currentResponse.data.values?.[0] || [];

        const updatedRow = [
            updates.id ?? currentRow[0],
            updates.quizId ?? currentRow[1],
            updates.type ?? currentRow[2],
            updates.text ?? currentRow[3],
            updates.order ?? currentRow[4],
            updates.timeLimit ?? currentRow[5],
            updates.doublePoints ?? currentRow[6],
            updates.data ?? currentRow[7],
            currentRow[8], // createdAt stays the same
            updates.imageUrl ?? currentRow[9] ?? '',
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A${rowIndex + 1}:J${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [updatedRow],
            },
        });
    } catch (error) {
        console.error('Error updating question:', error);
        throw error;
    }
}

/**
 * Delete a question
 */
export async function deleteQuestion(questionId: string): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A:A`,
        });

        const rows = response.data.values;
        if (!rows) return;

        const rowIndex = rows.findIndex((row) => row[0] === questionId);
        if (rowIndex === -1) return;

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.QUESTIONS}!A${rowIndex + 1}:I${rowIndex + 1}`,
        });
    } catch (error) {
        console.error('Error deleting question:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CARD FUNCTIONS
// SectionCards sheet structure:
// A: ID
// B: QuizId
// C: Title
// D: Content (rich text/html)
// E: ImageUrl
// F: Order
// G: CreatedAt
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionCardData {
    id: string;
    quizId: string;
    title: string;
    content: string;
    imageUrl?: string;
    order: number;
    createdAt?: string;
}

/**
 * Ensure the SectionCards sheet exists
 */
async function ensureSectionCardsSheetExists(): Promise<void> {
    const sheets = getGoogleSheetsClient();

    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEETS.SECTION_CARDS
    );

    if (!sheet) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: SHEETS.SECTION_CARDS,
                            },
                        },
                    },
                ],
            },
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A1:G1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['ID', 'QuizId', 'Title', 'Content', 'ImageUrl', 'Order', 'CreatedAt']],
            },
        });
    }
}

/**
 * Get all section cards for a quiz
 */
export async function getSectionCards(quizId: string): Promise<SectionCardData[]> {
    try {
        await ensureSectionCardsSheetExists();
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A:F`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) return [];

        return rows
            .slice(1)
            .filter((row) => row[1]?.toString().trim().toLowerCase() === quizId.trim().toLowerCase())
            .map((row) => ({
                id: row[0] || '',
                quizId: row[1] || '',
                title: row[2] || '',
                content: row[3] || '',
                imageUrl: row[4] || '',
                order: parseInt(row[5], 10) || 0,
                createdAt: row[6] || '',
            }))
            .sort((a, b) => a.order - b.order);
    } catch (error) {
        console.error('Error getting section cards:', error);
        throw error;
    }
}

/**
 * Create a new section card
 */
export async function createSectionCard(card: SectionCardData): Promise<void> {
    try {
        await ensureSectionCardsSheetExists();
        const sheets = getGoogleSheetsClient();
        const now = new Date().toISOString();

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A:G`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    card.id,
                    card.quizId,
                    card.title,
                    card.content,
                    card.imageUrl || '',
                    card.order,
                    now,
                ]],
            },
        });
    } catch (error) {
        console.error('Error creating section card:', error);
        throw error;
    }
}

/**
 * Update a section card
 */
export async function updateSectionCard(cardId: string, updates: Partial<SectionCardData>): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A:A`,
        });

        const rows = response.data.values;
        if (!rows) return;

        const rowIndex = rows.findIndex((row) => row[0] === cardId);
        if (rowIndex === -1) return;

        const currentResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A${rowIndex + 1}:G${rowIndex + 1}`,
        });

        const currentRow = currentResponse.data.values?.[0] || [];

        const updatedRow = [
            updates.id ?? currentRow[0],
            updates.quizId ?? currentRow[1],
            updates.title ?? currentRow[2],
            updates.content ?? currentRow[3],
            updates.imageUrl ?? currentRow[4],
            updates.order ?? currentRow[5],
            currentRow[6], // createdAt
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A${rowIndex + 1}:G${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [updatedRow],
            },
        });
    } catch (error) {
        console.error('Error updating section card:', error);
        throw error;
    }
}

/**
 * Delete a section card
 */
export async function deleteSectionCard(cardId: string): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A:A`,
        });

        const rows = response.data.values;
        if (!rows) return;

        const rowIndex = rows.findIndex((row) => row[0] === cardId);
        if (rowIndex === -1) return;

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SECTION_CARDS}!A${rowIndex + 1}:G${rowIndex + 1}`,
        });
    } catch (error) {
        console.error('Error deleting section card:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD FUNCTIONS
// Leaderboard sheet structure:
// A: ID
// B: SessionId (quiz session identifier)
// C: QuizId
// D: ParticipantRegId
// E: ParticipantName
// F: SchoolName
// G: TotalScore
// H: CorrectAnswers
// I: TotalQuestions
// J: TimeTaken (total ms)
// K: Rank
// L: CompletedAt
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    id: string;
    sessionId: string;
    quizId: string;
    participantRegId: string;
    participantName: string;
    schoolName: string;
    totalScore: number;
    correctAnswers: number;
    totalQuestions: number;
    timeTaken: number;
    rank: number;
    completedAt: string;
}

/**
 * Save a leaderboard entry
 */
export async function saveLeaderboardEntry(entry: LeaderboardEntry): Promise<void> {
    try {
        // Ensure the sheet exists first
        await ensureLeaderboardSheetExists();

        const sheets = getGoogleSheetsClient();

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.LEADERBOARD}!A:L`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    entry.id,
                    entry.sessionId,
                    entry.quizId,
                    entry.participantRegId,
                    entry.participantName,
                    entry.schoolName,
                    entry.totalScore,
                    entry.correctAnswers,
                    entry.totalQuestions,
                    entry.timeTaken,
                    entry.rank,
                    entry.completedAt,
                ]],
            },
        });
    } catch (error) {
        console.error('Error saving leaderboard entry:', error);
        throw error;
    }
}

/**
 * Get leaderboard for a session
 */
export async function getLeaderboardBySessionId(sessionId: string): Promise<LeaderboardEntry[]> {
    try {
        // Ensure the sheet exists first
        await ensureLeaderboardSheetExists();

        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.LEADERBOARD}!A:L`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return [];
        }

        return rows
            .slice(1)
            .filter((row) => row[1] === sessionId && row[0])
            .map((row) => ({
                id: row[0] || '',
                sessionId: row[1] || '',
                quizId: row[2] || '',
                participantRegId: row[3] || '',
                participantName: row[4] || '',
                schoolName: row[5] || '',
                totalScore: parseInt(row[6], 10) || 0,
                correctAnswers: parseInt(row[7], 10) || 0,
                totalQuestions: parseInt(row[8], 10) || 0,
                timeTaken: parseInt(row[9], 10) || 0,
                rank: parseInt(row[10], 10) || 0,
                completedAt: row[11] || '',
            }))
            .sort((a, b) => a.rank - b.rank);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        throw error;
    }
}

/**
 * Get all leaderboard entries for a quiz (across all sessions)
 */
export async function getLeaderboardByQuizId(quizId: string): Promise<LeaderboardEntry[]> {
    try {
        // Ensure the sheet exists first
        await ensureLeaderboardSheetExists();

        const sheets = getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.LEADERBOARD}!A:L`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return [];
        }

        return rows
            .slice(1)
            .filter((row) => row[2] === quizId && row[0])
            .map((row) => ({
                id: row[0] || '',
                sessionId: row[1] || '',
                quizId: row[2] || '',
                participantRegId: row[3] || '',
                participantName: row[4] || '',
                schoolName: row[5] || '',
                totalScore: parseInt(row[6], 10) || 0,
                correctAnswers: parseInt(row[7], 10) || 0,
                totalQuestions: parseInt(row[8], 10) || 0,
                timeTaken: parseInt(row[9], 10) || 0,
                rank: parseInt(row[10], 10) || 0,
                completedAt: row[11] || '',
            }))
            .sort((a, b) => b.totalScore - a.totalScore);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        throw error;
    }
}

/**
 * Update ranks for a session's leaderboard after all scores are calculated
 */
export async function updateSessionRanks(sessionId: string): Promise<void> {
    try {
        const entries = await getLeaderboardBySessionId(sessionId);

        // Sort by score descending
        entries.sort((a, b) => b.totalScore - a.totalScore);

        // Update ranks
        const sheets = getGoogleSheetsClient();

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const newRank = i + 1;

            // Find row and update rank
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.LEADERBOARD}!A:A`,
            });

            const rows = response.data.values;
            if (!rows) continue;

            const rowIndex = rows.findIndex((row) => row[0] === entry.id);
            if (rowIndex === -1) continue;

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.LEADERBOARD}!K${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[newRank]],
                },
            });
        }
    } catch (error) {
        console.error('Error updating ranks:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Initialize sheets with headers if they don't exist
// ─────────────────────────────────────────────────────────────────────────────

export async function initializeSheets(): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        // Check if Questions sheet exists and has headers
        try {
            const questionsResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.QUESTIONS}!A1:J1`,
            });

            if (!questionsResponse.data.values || questionsResponse.data.values.length === 0) {
                // Add headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEETS.QUESTIONS}!A1:J1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['ID', 'QuizId', 'Type', 'Text', 'Order', 'TimeLimit', 'DoublePoints', 'Data', 'CreatedAt']],
                    },
                });
            }
        } catch {
            console.log('Questions sheet may not exist yet');
        }

        // Check if Leaderboard sheet exists and has headers
        try {
            const leaderboardResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.LEADERBOARD}!A1:L1`,
            });

            if (!leaderboardResponse.data.values || leaderboardResponse.data.values.length === 0) {
                // Add headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEETS.LEADERBOARD}!A1:L1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['ID', 'SessionId', 'QuizId', 'ParticipantRegId', 'ParticipantName', 'SchoolName', 'TotalScore', 'CorrectAnswers', 'TotalQuestions', 'TimeTaken', 'Rank', 'CompletedAt']],
                    },
                });
            }
        } catch {
            console.log('Leaderboard sheet may not exist yet');
        }

        // Check if Responses sheet exists and has headers
        try {
            const responsesResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.RESPONSES}!A1:L1`,
            });

            if (!responsesResponse.data.values || responsesResponse.data.values.length === 0) {
                // Add headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEETS.RESPONSES}!A1:L1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['SessionId', 'QuizId', 'QuestionId', 'QuestionNumber', 'QuestionText', 'ParticipantRegId', 'ParticipantName', 'Answer', 'IsCorrect', 'TimeTaken', 'Points', 'SubmittedAt']],
                    },
                });
            }
        } catch {
            console.log('Responses sheet may not exist yet, will be created on first save');
        }
    } catch (error) {
        console.error('Error initializing sheets:', error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE DATA FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResponseEntry {
    sessionId: string;
    quizId: string;
    questionId: string;
    questionNumber: number;
    questionText: string;
    participantRegId: string;
    participantName: string;
    answer: string; // JSON stringified answer
    isCorrect: boolean;
    timeTaken: number; // ms
    points: number;
    submittedAt: string;
}

/**
 * Ensure the Responses sheet exists with proper headers
 */
async function ensureResponsesSheetExists(): Promise<void> {
    const sheets = getGoogleSheetsClient();

    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const responsesSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === SHEETS.RESPONSES
    );

    if (!responsesSheet) {
        // Create the Responses sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: SHEETS.RESPONSES,
                            },
                        },
                    },
                ],
            },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.RESPONSES}!A1:L1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['SessionId', 'QuizId', 'QuestionId', 'QuestionNumber', 'QuestionText', 'ParticipantRegId', 'ParticipantName', 'Answer', 'IsCorrect', 'TimeTaken', 'Points', 'SubmittedAt']],
            },
        });
    }
}

/**
 * Save a single response entry to the Responses sheet
 */
export async function saveResponseEntry(entry: ResponseEntry): Promise<void> {
    try {
        await ensureResponsesSheetExists();

        const sheets = getGoogleSheetsClient();

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.RESPONSES}!A:L`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    entry.sessionId,
                    entry.quizId,
                    entry.questionId,
                    entry.questionNumber,
                    entry.questionText,
                    entry.participantRegId,
                    entry.participantName,
                    entry.answer,
                    entry.isCorrect ? 'TRUE' : 'FALSE',
                    entry.timeTaken,
                    entry.points,
                    entry.submittedAt,
                ]],
            },
        });
    } catch (error) {
        console.error('Error saving response entry:', error);
        throw error;
    }
}

/**
 * Save multiple response entries in batch
 */
export async function saveResponsesBatch(entries: ResponseEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
        await ensureResponsesSheetExists();

        const sheets = getGoogleSheetsClient();

        const values = entries.map(entry => [
            entry.sessionId,
            entry.quizId,
            entry.questionId,
            entry.questionNumber,
            entry.questionText,
            entry.participantRegId,
            entry.participantName,
            entry.answer,
            entry.isCorrect ? 'TRUE' : 'FALSE',
            entry.timeTaken,
            entry.points,
            entry.submittedAt,
        ]);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.RESPONSES}!A:L`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });

        console.log(`Saved ${entries.length} response entries to sheet`);
    } catch (error) {
        console.error('Error saving response entries batch:', error);
        throw error;
    }
}

/**
 * Batch update orders for questions and section cards
 */
export async function updateQuizOrder(items: { id: string; type: 'question' | 'section'; order: number }[]): Promise<void> {
    try {
        const sheets = getGoogleSheetsClient();

        // Split items
        const questionItems = items.filter(i => i.type === 'question');
        const sectionItems = items.filter(i => i.type === 'section');

        const dataToUpdate: { range: string; values: any[][] }[] = [];

        // Process Questions
        if (questionItems.length > 0) {
            const qRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.QUESTIONS}!A:A`
            });
            const qRows = qRes.data.values || [];
            const qIdToRow = new Map<string, number>();
            qRows.forEach((row, idx) => {
                // idx 0 is header usually, but we check all just in case
                if (row[0]) qIdToRow.set(row[0], idx + 1);
            });

            questionItems.forEach(item => {
                const row = qIdToRow.get(item.id);
                if (row) {
                    dataToUpdate.push({
                        range: `${SHEETS.QUESTIONS}!E${row}`,
                        values: [[item.order]]
                    });
                }
            });
        }

        // Process Sections
        if (sectionItems.length > 0) {
            const sRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.SECTION_CARDS}!A:A`
            });
            const sRows = sRes.data.values || [];
            const sIdToRow = new Map<string, number>();
            sRows.forEach((row, idx) => {
                if (row[0]) sIdToRow.set(row[0], idx + 1);
            });

            sectionItems.forEach(item => {
                const row = sIdToRow.get(item.id);
                if (row) {
                    dataToUpdate.push({
                        range: `${SHEETS.SECTION_CARDS}!E${row}`,
                        values: [[item.order]]
                    });
                }
            });
        }

        if (dataToUpdate.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: dataToUpdate
                }
            });
        }
    } catch (error) {
        console.error('Error updating quiz order:', error);
        throw error;
    }
}
