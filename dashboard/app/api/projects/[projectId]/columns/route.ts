import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects/[projectId]/columns - Get all columns for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const columns = await db_queries_projects.getProjectColumns(projectId);

    return NextResponse.json({ columns });
  } catch (error: any) {
    console.error('Error fetching columns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch columns', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/columns - Create a new column
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { name, position, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const column = await db_queries_projects.createColumn({
      project_id: projectId,
      name,
      position: position ?? 0,
      color,
    });

    return NextResponse.json({ column });
  } catch (error: any) {
    console.error('Error creating column:', error);
    return NextResponse.json(
      { error: 'Failed to create column', details: error.message },
      { status: 500 }
    );
  }
}
