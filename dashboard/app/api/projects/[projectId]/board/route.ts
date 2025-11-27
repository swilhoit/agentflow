import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects/[projectId]/board - Get full board data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const boardData = await db_queries_projects.getFullBoard(projectId);

    if (!boardData || !boardData.project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(boardData);
  } catch (error: any) {
    console.error('Error fetching board:', error);
    return NextResponse.json(
      { error: 'Failed to fetch board', details: error.message },
      { status: 500 }
    );
  }
}
