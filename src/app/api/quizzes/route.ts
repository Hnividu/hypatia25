import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getQuiz, saveQuiz, getQuestionsByQuizId, listSheets, MAIN_QUIZ_ID } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/quizzes - Get the single quiz with its questions
export async function GET(request: NextRequest) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            console.error('[API] Unauthorized access attempt to /api/quizzes from:', request.nextUrl.pathname);
            // Check debug details about why auth failed
            const token = request.cookies.get('quiz-admin-token');
            console.error('[API] Auth failure details: Cookie present?', !!token, 'Token value:', token?.value ? '(hidden)' : 'missing');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
            const [quiz, questions] = await Promise.all([
                getQuiz(),
                getQuestionsByQuizId(MAIN_QUIZ_ID),
            ]);

            return NextResponse.json({
                quiz: {
                    id: MAIN_QUIZ_ID,
                    name: quiz.name,
                    description: quiz.description,
                    updatedAt: quiz.updatedAt,
                    questionCount: questions.length,
                },
                questions,
            });
        } catch (sheetsError) {
            console.error('Google Sheets error:', sheetsError);

            // Try to list sheets for debugging
            const sheetList = await listSheets().catch(() => []);

            return NextResponse.json({
                quiz: {
                    id: MAIN_QUIZ_ID,
                    name: 'Untitled Quiz',
                    description: '',
                    questionCount: 0,
                },
                questions: [],
                warning: `Google Sheets Error: ${sheetsError instanceof Error ? sheetsError.message : 'Unknown error'}. Available sheets: ${sheetList.join(', ')}`,
                debug: { availableSheets: sheetList },
            });
        }
    } catch (error) {
        console.error('Error fetching quiz:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quiz' },
            { status: 500 }
        );
    }
}

// POST /api/quizzes - Update the quiz name/description
export async function POST(request: NextRequest) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        await saveQuiz(name, description || '');

        return NextResponse.json({
            success: true,
            message: 'Quiz updated successfully',
        });
    } catch (error) {
        console.error('Error updating quiz:', error);
        return NextResponse.json(
            { error: 'Failed to update quiz' },
            { status: 500 }
        );
    }
}
