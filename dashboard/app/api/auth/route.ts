import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Set your password here or use environment variable
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'agentflow2025';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === DASHBOARD_PASSWORD) {
      const cookieStore = await cookies();
      
      // Set auth cookie - expires in 7 days
      cookieStore.set('agentflow-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('agentflow-auth');
  return NextResponse.json({ success: true });
}









