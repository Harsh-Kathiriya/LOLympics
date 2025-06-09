import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json(
      { error: 'ABLY_API_KEY environment variable not set' },
      { status: 500 }
    );
  }

  const ably = new Ably.Rest(process.env.ABLY_API_KEY);

  const tokenParams: Ably.TokenParams = {
    clientId: session.user.id,
    capability: {
      'room:*': ['subscribe', 'publish', 'presence', 'history'],
    },
    ttl: 60 * 60 * 2 * 1000, // Token is valid for 2 hours
  };

  try {
    const tokenRequest = await ably.auth.createTokenRequest(tokenParams);
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Error creating Ably token:', error);
    return NextResponse.json(
      { error: 'Failed to create Ably token' },
      { status: 500 }
    );
  }
} 