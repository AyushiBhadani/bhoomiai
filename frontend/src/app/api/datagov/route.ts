import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for data.gov.in API calls.
 * Avoids CORS issues by routing through Next.js server.
 * Usage: GET /api/datagov?resource=RESOURCE_ID&q=QUERY&limit=10
 */

const DATAGOV_API_KEY = process.env.DATAGOV_API_KEY || '579b464db66ec23bdd000001c6dba14b30634e5a';
const BASE = 'https://api.data.gov.in/resource';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  const limit    = searchParams.get('limit') || '10';
  const offset   = searchParams.get('offset') || '0';
  const q        = searchParams.get('q') || '';

  if (!resource) {
    return NextResponse.json({ error: 'resource ID required' }, { status: 400 });
  }

  const params = new URLSearchParams({
    'api-key': DATAGOV_API_KEY,
    format: 'json',
    limit,
    offset,
  });
  if (q) params.set('filters[keyword]', q);

  const url = `${BASE}/${resource}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) {
      return NextResponse.json({ error: `data.gov.in returned ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch from data.gov.in', detail: String(err) }, { status: 500 });
  }
}
