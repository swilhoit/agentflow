import { NextRequest, NextResponse } from 'next/server';
import { db_queries_projects } from '@/lib/database-projects';

// GET /api/projects - Get all projects for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || 'default-user';

    const projects = await db_queries_projects.getAllProjects(userId);

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, description, color, icon } = body;

    if (!user_id || !name) {
      return NextResponse.json(
        { error: 'user_id and name are required' },
        { status: 400 }
      );
    }

    const project = await db_queries_projects.createProject({
      user_id,
      name,
      description,
      color,
      icon,
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    );
  }
}
