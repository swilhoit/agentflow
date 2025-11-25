import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - can happen in Server Components
          }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { guildId, guildName } = body;

    if (!guildId) {
      return NextResponse.json(
        { error: 'Guild ID is required' },
        { status: 400 }
      );
    }

    // Check if guild is already registered to another user
    const { data: existingGuild } = await supabase
      .from('guild_registrations')
      .select('user_id')
      .eq('guild_id', guildId)
      .single();

    if (existingGuild && existingGuild.user_id !== user.id) {
      return NextResponse.json(
        { error: 'This server is already connected to another account' },
        { status: 409 }
      );
    }

    // Check user's guild limit based on subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';
    const guildLimits: Record<string, number> = {
      free: 1,
      pro: 5,
      enterprise: -1, // unlimited
    };

    const limit = guildLimits[tier] || 1;

    if (limit !== -1) {
      const { count } = await supabase
        .from('guild_registrations')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if ((count || 0) >= limit) {
        return NextResponse.json(
          { 
            error: `You've reached your server limit (${limit}). Upgrade to connect more servers.`,
            code: 'GUILD_LIMIT_REACHED'
          },
          { status: 403 }
        );
      }
    }

    // Register the guild
    const { data: registration, error: insertError } = await supabase
      .from('guild_registrations')
      .upsert({
        user_id: user.id,
        guild_id: guildId,
        guild_name: guildName || `Server ${guildId}`,
        is_active: true,
        registered_at: new Date().toISOString(),
      }, {
        onConflict: 'guild_id',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error registering guild:', insertError);
      return NextResponse.json(
        { error: 'Failed to connect server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Server connected successfully',
      registration: {
        guildId: registration.guild_id,
        guildName: registration.guild_name,
        isActive: registration.is_active,
        registeredAt: registration.registered_at,
      },
    });

  } catch (error) {
    console.error('Error in guild connect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List user's connected servers
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: guilds, error } = await supabase
      .from('guild_registrations')
      .select('*')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Error fetching guilds:', error);
      return NextResponse.json(
        { error: 'Failed to fetch servers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      guilds: guilds.map(g => ({
        guildId: g.guild_id,
        guildName: g.guild_name,
        isActive: g.is_active,
        registeredAt: g.registered_at,
        settings: g.settings,
      })),
    });

  } catch (error) {
    console.error('Error fetching guilds:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect a server
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId');

    if (!guildId) {
      return NextResponse.json(
        { error: 'Guild ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('guild_registrations')
      .delete()
      .eq('user_id', user.id)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting guild:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Server disconnected',
    });

  } catch (error) {
    console.error('Error deleting guild:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

