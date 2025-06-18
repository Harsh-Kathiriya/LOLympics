import { NextResponse, NextRequest } from 'next/server';

// This is the backend proxy route for SEARCHING for memes on Tenor.
// It receives a request with a search query from the client, forwards it to the Tenor API,
// and then pipes the response back to the client. This avoids CORS errors and protects the API key.
export async function GET(request: NextRequest) {
  const apiKey = process.env.TENOR_API_KEY;
  const clientKey = process.env.NEXT_PUBLIC_TENOR_CLIENT_KEY;

  if (!apiKey || !clientKey) {
    return NextResponse.json(
      { error: 'Tenor API key is not configured.' },
      { status: 500 }
    );
  }

  // Extract the search query from the client's request.
  const searchQuery = request.nextUrl.searchParams.get('q');
  if (!searchQuery) {
    return NextResponse.json(
        { error: 'Search query parameter "q" is required.' },
        { status: 400 }
    );
  }

  const searchUrl = new URL('https://tenor.googleapis.com/v2/search');
  searchUrl.searchParams.set('key', apiKey);
  searchUrl.searchParams.set('client_key', clientKey);
  searchUrl.searchParams.set('q', searchQuery);
  searchUrl.searchParams.set('limit', '24');
  searchUrl.searchParams.set('media_filter', 'gif');

  // Forward the `pos` param for pagination if it exists
  const pos = request.nextUrl.searchParams.get('pos');
  if (pos) {
    searchUrl.searchParams.set('pos', pos);
  }

  try {
    const tenorResponse = await fetch(searchUrl.toString());

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