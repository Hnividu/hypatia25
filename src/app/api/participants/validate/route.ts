import { NextRequest, NextResponse } from 'next/server';
import { validateParticipant } from '@/lib/googleSheets';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { regId } = body;

        if (!regId) {
            return NextResponse.json(
                { error: 'Registration ID is required' },
                { status: 400 }
            );
        }

        const participant = await validateParticipant(regId);

        if (!participant) {
            return NextResponse.json(
                {
                    valid: false,
                    error: 'Registration ID not found. Please check and try again.'
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            valid: true,
            participant: {
                regId: participant.regId,
                name: participant.name,
                schoolName: participant.schoolName,
            },
        });
    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json(
            {
                valid: false,
                error: 'Unable to validate. Please try again later.'
            },
            { status: 500 }
        );
    }
}
