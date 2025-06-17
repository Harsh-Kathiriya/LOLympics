import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// This is the backend proxy route for fetching TRENDING memes from Tenor.
// It receives a request from the client, forwards it to the Tenor API with the secret key,
// and then pipes the response back to the client. This avoids CORS errors and protects the API key.
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
  featuredUrl.searchParams.set('media_filter', 'gif');

  try {
    const tenorResponse = await fetch(featuredUrl.toString());

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