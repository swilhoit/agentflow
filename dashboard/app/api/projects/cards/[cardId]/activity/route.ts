import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects/cards/[cardId]/activity - Get activity for a card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const activity = await db_queries_projects.getCardActivity(cardId, limit);

    return NextResponse.json({ activity });
  } catch (error: any) {
    console.error('Error fetching card activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card activity', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects/cards/[cardId]/activity - Log activity for a card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();

    // Ensure card exists first
    const card = await db_queries_projects.getCard(cardId);
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const activity = await db_queries_projects.logCardActivity({
      card_id: cardId,
      project_id: card.project_id,
      agent_name: body.agent_name,
      user_id: body.user_id,
      action_type: body.action_type,
      action_details: body.action_details,
      from_value: body.from_value,
      to_value: body.to_value,
    });

    return NextResponse.json({ activity });
  } catch (error: any) {
    console.error('Error logging card activity:', error);
    return NextResponse.json(
      { error: 'Failed to log card activity', details: error.message },
      { status: 500 }
    );
  }
}
