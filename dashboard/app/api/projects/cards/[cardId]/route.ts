import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects/cards/[cardId] - Get a single card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;

    const card = await db_queries_projects.getCard(cardId);

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/cards/[cardId] - Update a card
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();

    const card = await db_queries_projects.updateCard(cardId, body);

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Error updating card:', error);
    return NextResponse.json(
      { error: 'Failed to update card', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/cards/[cardId] - Delete a card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;

    await db_queries_projects.deleteCard(cardId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      { error: 'Failed to delete card', details: error.message },
      { status: 500 }
    );
  }
}
