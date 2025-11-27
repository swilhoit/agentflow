import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY!;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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
          } catch {}
        },
      },
    }
  );
}

// Supported services and their credential structure
const SERVICE_CONFIGS: Record<string, { fields: string[]; testEndpoint?: string }> = {
  anthropic: {
    fields: ['apiKey'],
    testEndpoint: 'https://api.anthropic.com/v1/messages',
  },
  elevenlabs: {
    fields: ['apiKey', 'agentId'],
    testEndpoint: 'https://api.elevenlabs.io/v1/user',
  },
  teller: {
    fields: ['accessToken'],
  },
  finnhub: {
    fields: ['apiKey'],
    testEndpoint: 'https://finnhub.io/api/v1/quote',
  },
  trello: {
    fields: ['apiKey', 'apiToken'],
  },
  groq: {
    fields: ['apiKey'],
  },
};

// GET - List configured credentials (masked)
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: credentials, error } = await supabase
      .from('user_credentials')
      .select('service_name, is_valid, last_validated_at, updated_at')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching credentials:', error);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }

    // Return which services are configured (not the actual credentials)
    const configuredServices = (credentials || []).map(c => ({
      service: c.service_name,
      isValid: c.is_valid,
      lastValidated: c.last_validated_at,
      updatedAt: c.updated_at,
    }));

    // List all available services with their status
    const services = Object.keys(SERVICE_CONFIGS).map(service => {
      const configured = configuredServices.find(c => c.service === service);
      return {
        service,
        configured: !!configured,
        isValid: configured?.isValid ?? null,
        lastValidated: configured?.lastValidated ?? null,
        updatedAt: configured?.updatedAt ?? null,
        fields: SERVICE_CONFIGS[service].fields,
      };
    });

    return NextResponse.json({ services });

  } catch (error) {
    console.error('Error in credentials GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save or update credentials
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { service, credentials } = body;

    if (!service || !credentials) {
      return NextResponse.json(
        { error: 'Service and credentials are required' },
        { status: 400 }
      );
    }

    const serviceConfig = SERVICE_CONFIGS[service];
    if (!serviceConfig) {
      return NextResponse.json(
        { error: `Unknown service: ${service}` },
        { status: 400 }
      );
    }

    // Validate required fields
    for (const field of serviceConfig.fields) {
      if (!credentials[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Test the credentials if we have a test endpoint
    let isValid = true;
    if (serviceConfig.testEndpoint && service === 'anthropic') {
      try {
        const testRes = await fetch(serviceConfig.testEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': credentials.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        isValid = testRes.status !== 401;
      } catch {
        // If test fails, still save but mark as unvalidated
        isValid = false;
      }
    }

    // Encrypt credentials
    const encryptedCredentials = encrypt(JSON.stringify(credentials));

    // Save to database
    const { error: saveError } = await supabase
      .from('user_credentials')
      .upsert({
        user_id: user.id,
        service_name: service,
        encrypted_credentials: encryptedCredentials,
        is_valid: isValid,
        last_validated_at: isValid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,service_name',
      });

    if (saveError) {
      console.error('Error saving credentials:', saveError);
      return NextResponse.json(
        { error: 'Failed to save credentials' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${service} credentials saved successfully`,
      isValid,
    });

  } catch (error) {
    console.error('Error in credentials POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove credentials
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (!service) {
      return NextResponse.json(
        { error: 'Service is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('service_name', service);

    if (error) {
      console.error('Error deleting credentials:', error);
      return NextResponse.json(
        { error: 'Failed to delete credentials' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${service} credentials removed`,
    });

  } catch (error) {
    console.error('Error in credentials DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}








