import { NextRequest, NextResponse } from 'next/server';
import { db_queries_agents } from '@/lib/database-agents';

// GET /api/agents - Get all agents
export async function GET(request: NextRequest) {
  try {
    const agents = await db_queries_agents.getAllAgents();

    return NextResponse.json({ agents });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: error.message },
      { status: 500 }
    );
  }
}
