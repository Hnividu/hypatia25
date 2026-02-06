import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getQuestionsByQuizId, createQuestion, MAIN_QUIZ_ID, QuestionData } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/quizzes/questions - Get all questions for the main quiz
export async function GET() {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const questions = await getQuestionsByQuizId(MAIN_QUIZ_ID);
        return NextResponse.json({ questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch questions' },
            { status: 500 }
        );
    }
}

// POST /api/quizzes/questions - Create a new question
export async function POST(request: NextRequest) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { type, text, order, timeLimit, doublePoints, data, imageUrl } = body;

        if (!type || !text) {
            return NextResponse.json(
                { error: 'Type and text are required' },
                { status: 400 }
            );
        }

        const question: QuestionData = {
            id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            quizId: MAIN_QUIZ_ID,
            type,
            text,
            order: order || 0,
            timeLimit: timeLimit || 30,
            doublePoints: doublePoints || false,
            data: typeof data === 'string' ? data : JSON.stringify(data || {}),
            imageUrl: imageUrl || '',
        };

        await createQuestion(question);

        return NextResponse.json({
            success: true,
            question,
            message: 'Question created successfully',
        });
    } catch (error) {
        console.error('Error creating question:', error);
        return NextResponse.json(
            { error: 'Failed to create question' },
            { status: 500 }
        );
    }
}
