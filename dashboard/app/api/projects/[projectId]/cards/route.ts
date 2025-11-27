import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects/[projectId]/cards - Get all cards for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const cards = await db_queries_projects.getProjectCards(projectId);

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/cards - Create a new card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { column_id, title, description, priority, due_date, labels, position } = body;

    if (!column_id || !title) {
      return NextResponse.json(
        { error: 'column_id and title are required' },
        { status: 400 }
      );
    }

    const card = await db_queries_projects.createCard({
      project_id: projectId,
      column_id,
      title,
      description,
      priority,
      due_date,
      labels,
      position: position ?? 0,
    });

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Error creating card:', error);
    return NextResponse.json(
      { error: 'Failed to create card', details: error.message },
      { status: 500 }
    );
  }
}
