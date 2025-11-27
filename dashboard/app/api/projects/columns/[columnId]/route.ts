import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// PATCH /api/projects/columns/[columnId] - Update a column
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ columnId: string }> }
) {
  try {
    const { columnId } = await params;
    const body = await request.json();

    const column = await db_queries_projects.updateColumn(columnId, body);

    return NextResponse.json({ column });
  } catch (error: any) {
    console.error('Error updating column:', error);
    return NextResponse.json(
      { error: 'Failed to update column', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/columns/[columnId] - Delete a column
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ columnId: string }> }
) {
  try {
    const { columnId } = await params;

    await db_queries_projects.deleteColumn(columnId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting column:', error);
    return NextResponse.json(
      { error: 'Failed to delete column', details: error.message },
      { status: 500 }
    );
  }
}
