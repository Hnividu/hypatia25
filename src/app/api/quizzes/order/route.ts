
import { NextResponse } from 'next/server';
import { updateQuizOrder } from '@/lib/googleSheets';

export async function POST(request: Request) {
    try {
        const { items } = await request.json();

        if (!items || !Array.isArray(items)) {
            return NextResponse.json(
                { error: 'Invalid data format. Expected array of items.' },
                { status: 400 }
            );
        }

        await updateQuizOrder(items);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating quiz order:', error);
        return NextResponse.json(
            { error: 'Failed to update quiz order' },
            { status: 500 }
        );
    }
}
