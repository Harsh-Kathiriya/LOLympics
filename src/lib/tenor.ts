// src/lib/tenor.ts

// The functions in this file have been refactored to call our internal API routes
// instead of calling the Tenor API directly from the client. This is the standard
// pattern for using APIs with secret keys in a Next.js application.

export interface TenorMeme {
  id: string;
  url: string; // URL for the GIF
  name: string; // Content description
}

/**
 * Transforms raw Tenor API result from our proxy into our simplified TenorMeme format.
 * 
 * @param result A single result object from the Tenor API.
 * @returns A TenorMeme object.
 */
function transformMeme(result: any): TenorMeme {
  // Prefer the much smaller tinygif variant when available
  const mediaFormat =
    result.media_formats?.tinygif ||
    result.media_formats?.gif ||
    result.media?.[0]?.tinygif ||
    result.media?.[0]?.gif;
  if (!mediaFormat) {
    console.warn('Meme result missing GIF format:', result);
    // Return a placeholder or skip this meme
    return { id: result.id, url: '', name: 'Invalid format' };
  }

  return {
    id: result.id,
    url: mediaFormat.url,
    name: result.content_description,
  };
}

/**
 * Searches for memes by calling our internal search proxy API route.
 * 
 * @param query The search term.
 * @param limit The number of results to return.
 * @param pos The starting position for the results (for pagination).
 * @returns An object containing the list of memes and the next position for pagination.
 */
export async function searchTenorMemes(query: string, limit: number = 24, pos?: string) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  if (pos) {
    params.set('pos', pos);
  }
  
  // Call our own backend route, which will then call Tenor.
  const response = await fetch(`/api/memes/search?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to search memes: ${errorData.error || 'Unknown error'}`);
  }
  
  const data = await response.json();
  
  return {
    memes: data.results.map(transformMeme).filter((meme: TenorMeme) => meme.url), // Filter out invalid formats
    next: data.next, // The 'next' property from Tenor's response is the position for the next page
  };
}

/**
 * Fetches the initial set of memes to display in the meme selection screen.
 * Instead of showing generic trending memes, this function now performs a specific
 * search for "wild party" to fit the chaotic and fun theme of the game.
 *
 * @param limit The number of memes to fetch.
 * @returns A promise that resolves to an array of TenorMeme objects.
 */
export async function getTrendingTenorMemes(limit: number = 24, pos?: string) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (pos) {
    params.set('pos', pos);
  }

  // Call our own backend route for trending memes.
  const response = await fetch(`/api/memes/trending?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get trending memes: ${errorData.error || 'Unknown error'}`);
  }

  const data = await response.json();

  return {
    memes: data.results.map(transformMeme).filter((meme: TenorMeme) => meme.url), // Filter out invalid formats
    next: data.next,
  };
}
