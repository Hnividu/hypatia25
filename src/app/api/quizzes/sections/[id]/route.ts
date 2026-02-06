import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { updateSectionCard, deleteSectionCard } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT /api/quizzes/sections/[id] - Update a section card
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
        const { title, content, imageUrl, order } = body;

        await updateSectionCard(id, {
            title,
            content,
            imageUrl,
            order,
        });

        return NextResponse.json({
            success: true,
            message: 'Section card updated successfully',
        });
    } catch (error) {
        console.error('Error updating section card:', error);
        return NextResponse.json(
            { error: 'Failed to update section card' },
            { status: 500 }
        );
    }
}

// DELETE /api/quizzes/sections/[id] - Delete a section card
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
        await deleteSectionCard(id);

        return NextResponse.json({
            success: true,
            message: 'Section card deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting section card:', error);
        return NextResponse.json(
            { error: 'Failed to delete section card' },
            { status: 500 }
        );
    }
}
