import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { updateQuestion, deleteQuestion } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT /api/quizzes/questions/[id] - Update a question
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { type, text, order, timeLimit, doublePoints, data, imageUrl } = body;

        await updateQuestion(id, {
            type,
            text,
            order,
            timeLimit,
            doublePoints,
            data: typeof data === 'string' ? data : JSON.stringify(data || {}),
            imageUrl,
        });

        return NextResponse.json({
            success: true,
            message: 'Question updated successfully',
        });
    } catch (error) {
        console.error('Error updating question:', error);
        return NextResponse.json(
            { error: 'Failed to update question' },
            { status: 500 }
        );
    }
}

// DELETE /api/quizzes/questions/[id] - Delete a question
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await deleteQuestion(id);

        return NextResponse.json({
            success: true,
            message: 'Question deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting question:', error);
        return NextResponse.json(
            { error: 'Failed to delete question' },
            { status: 500 }
        );
    }
}
