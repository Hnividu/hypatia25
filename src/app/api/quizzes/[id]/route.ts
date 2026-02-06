import { NextRequest, NextResponse } from 'next/server';
import { getQuestionsByQuizId } from '@/lib/googleSheets';
import { isAuthenticated } from '@/lib/auth';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/quizzes/[id] - Get a specific quiz with questions
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const questions = await getQuestionsByQuizId(id);

        if (questions.length === 0) {
            return NextResponse.json({ error: 'Quiz not found or has no questions' }, { status: 404 });
        }

        // Parse the JSON data for each question
        const parsedQuestions = questions.map((q) => ({
            ...q,
            data: JSON.parse(q.data || '{}'),
        }));

        return NextResponse.json({
            quiz: {
                id,
                title: id,
                questionCount: questions.length,
            },
            questions: parsedQuestions,
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quiz' },
            { status: 500 }
        );
    }
}
