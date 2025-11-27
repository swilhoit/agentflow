import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// POST /api/projects/cards/[cardId]/move - Move a card to a different column
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();
    const { column_id, position } = body;

    if (!column_id) {
      return NextResponse.json(
        { error: 'column_id is required' },
        { status: 400 }
      );
    }

    const card = await db_queries_projects.moveCard(cardId, column_id, position ?? 0);

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Error moving card:', error);
    return NextResponse.json(
      { error: 'Failed to move card', details: error.message },
      { status: 500 }
    );
  }
}
