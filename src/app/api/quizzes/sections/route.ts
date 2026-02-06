import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSectionCards, createSectionCard, MAIN_QUIZ_ID, SectionCardData } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/quizzes/sections - Get all section cards for the main quiz
export async function GET() {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sections = await getSectionCards(MAIN_QUIZ_ID);
        return NextResponse.json({ sections });
    } catch (error) {
        console.error('Error fetching section cards:', error);
        return NextResponse.json(
            { error: 'Failed to fetch section cards' },
            { status: 500 }
        );
    }
}

// POST /api/quizzes/sections - Create a new section card
export async function POST(request: NextRequest) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, content, imageUrl, order } = body;

        if (!title) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            );
        }

        const sectionCard: SectionCardData = {
            id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            quizId: MAIN_QUIZ_ID,
            title,
            content: content || '',
            imageUrl: imageUrl || '',
            order: order || 0,
        };

        await createSectionCard(sectionCard);

        return NextResponse.json({
            success: true,
            sectionCard,
            message: 'Section card created successfully',
        });
    } catch (error) {
        console.error('Error creating section card:', error);
        return NextResponse.json(
            { error: 'Failed to create section card' },
            { status: 500 }
        );
    }
}
