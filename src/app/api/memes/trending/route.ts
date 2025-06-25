import { NextResponse, NextRequest } from 'next/server';
import { retryFetch } from '@/lib/retry-fetch';

// This is the backend proxy route for fetching FEATURED memes from Tenor.
// It forwards the request to the Tenor API and pipes the response back to the client.
export async function GET(request: NextRequest) {
  const apiKey = process.env.TENOR_API_KEY;
  const clientKey = process.env.NEXT_PUBLIC_TENOR_CLIENT_KEY;

  if (!apiKey || !clientKey) {
    // If the API keys are not configured, return a 500 error.
    return NextResponse.json({ error: 'Tenor API key is not configured.' }, { status: 500 });
  }

  // Construct the URL for the Tenor "featured" endpoint.
  const featuredUrl = new URL('https://tenor.googleapis.com/v2/featured');
  featuredUrl.searchParams.set('key', apiKey);
  featuredUrl.searchParams.set('client_key', clientKey);
  featuredUrl.searchParams.set('limit', '24');
  featuredUrl.searchParams.set('media_formats', 'gif,tinygif');

  // Forward the `pos` param for pagination if it exists
  const pos = request.nextUrl.searchParams.get('pos');
  if (pos) {
    featuredUrl.searchParams.set('pos', pos);
  }

  try {
    const tenorResponse = await retryFetch(featuredUrl.toString(), {}, 5);

    if (!tenorResponse.ok) {
      const errorData = await tenorResponse.json();
      console.error('Tenor API responded with an error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch from Tenor API', details: errorData },
        { status: tenorResponse.status }
      );
    }
    
    const data = await tenorResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('An unexpected error occurred while fetching from Tenor:', error);
    return NextResponse.json(
        { error: 'An internal server error occurred.' },
        { status: 500 }
    );
  }
} 