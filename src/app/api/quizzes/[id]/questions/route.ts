import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
    getQuestionsByQuizId,
    createQuestion,
    updateQuestion,
    deleteQuestion,
} from '@/lib/googleSheets';
import { isAuthenticated } from '@/lib/auth';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/quizzes/[id]/questions - Get all questions for a quiz
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const questions = await getQuestionsByQuizId(id);

        // Parse the JSON data for each question
        const parsedQuestions = questions.map((q) => ({
            ...q,
            data: JSON.parse(q.data || '{}'),
        }));

        return NextResponse.json({ questions: parsedQuestions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch questions' },
            { status: 500 }
        );
    }
}

// POST /api/quizzes/[id]/questions - Add a new question
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: quizId } = await params;
        const body = await request.json();
        const { type, text, timeLimit, doublePoints, data, order } = body;

        if (!type || !text) {
            return NextResponse.json(
                { error: 'Question type and text are required' },
                { status: 400 }
            );
        }

        // Get current question count for ordering
        const existingQuestions = await getQuestionsByQuizId(quizId);
        const questionOrder = order ?? existingQuestions.length;

        const question = {
            id: uuidv4(),
            quizId,
            type,
            text,
            order: questionOrder,
            timeLimit: timeLimit ?? 30,
            doublePoints: doublePoints ?? false,
            data: JSON.stringify(data || {}),
        };

        await createQuestion(question);

        return NextResponse.json(
            {
                question: {
                    ...question,
                    data: data || {},
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating question:', error);
        return NextResponse.json(
            { error: 'Failed to create question' },
            { status: 500 }
        );
    }
}

// PUT /api/quizzes/[id]/questions - Bulk update questions (for reordering)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { questions } = body;

        if (!Array.isArray(questions)) {
            return NextResponse.json(
                { error: 'Questions array is required' },
                { status: 400 }
            );
        }

        // Update each question
        await Promise.all(
            questions.map((q: { id: string; order: number }) =>
                updateQuestion(q.id, { order: q.order })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating questions:', error);
        return NextResponse.json(
            { error: 'Failed to update questions' },
            { status: 500 }
        );
    }
}
