import placesData from './backend/data/places.json';
import categoriesData from './backend/data/categories.json';
import provincesData from './backend/data/provinces.json';
import reviewsData from './backend/data/reviews.json';

type Place = Record<string, any>;
type Review = Record<string, any>;

interface Env {
  ASSETS: Fetcher;
}

const places = placesData as Place[];
const categories = categoriesData as any[];
const provinces = provincesData as any[];
const reviews = reviewsData as Review[];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

function getGoogleMapsUrl(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isGoogleMapsUrl(value: unknown) {
  const urlValue = getGoogleMapsUrl(value);
  if (!urlValue) return false;

  try {
    const url = new URL(urlValue);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      [
        'maps.app.goo.gl',
        'www.google.com',
        'google.com',
        'maps.google.com',
        'goo.gl',
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function filterPlaces(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase().trim() || '';
  const category = url.searchParams.get('category');
  const region = url.searchParams.get('region');
  const province = url.searchParams.get('province');
  const minRating = Number(url.searchParams.get('minRating') || 0);
  const sort = url.searchParams.get('sort');
  const featured = url.searchParams.get('featured');
  const popular = url.searchParams.get('popular');
  const recommended = url.searchParams.get('recommended');
  const limit = Number(url.searchParams.get('limit') || 0);

  let filtered = [...places];

  if (q) {
    filtered = filtered.filter((p) => {
      const values = [
        p.name?.th,
        p.name?.en,
        p.name?.zh,
        p.province?.th,
        p.province?.en,
        p.province?.zh,
        p.description?.th,
        p.description?.en,
        p.description?.zh,
      ];

      return values.some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(q),
      );
    });
  }

  if (category && category !== 'all') {
    filtered = filtered.filter((p) => p.categoryId === category);
  }

  if (region && region !== 'all') {
    filtered = filtered.filter((p) => p.regionId === region);
  }

  if (province && province !== 'all') {
    filtered = filtered.filter(
      (p) =>
        p.province?.th === province ||
        p.province?.en === province ||
        p.province?.zh === province,
    );
  }

  if (minRating > 0) {
    filtered = filtered.filter((p) => Number(p.rating || 0) >= minRating);
  }

  if (featured === 'true') {
    filtered = filtered.filter((p) => p.featured === true);
  }

  if (popular === 'true') {
    filtered = filtered.filter((p) => p.popular === true);
  }

  if (recommended === 'true') {
    filtered = filtered.filter((p) => p.recommended === true);
  }

  if (sort === 'rating') {
    filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  } else if (sort === 'popular') {
    filtered.sort(
      (a, b) => Number(b.reviewCount || 0) - Number(a.reviewCount || 0),
    );
  } else if (sort === 'name') {
    filtered.sort((a, b) =>
      String(a.name?.th || '').localeCompare(String(b.name?.th || '')),
    );
  }

  if (limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function handleApi(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === 'GET' && pathname === '/api/health') {
    return json({
      status: 'ok',
      service: 'thai-smart-trip-api',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
    });
  }

  if (request.method === 'GET' && pathname === '/api/categories') {
    return json(categories);
  }

  if (request.method === 'GET' && pathname === '/api/provinces') {
    return json(provinces);
  }

  if (request.method === 'GET' && pathname === '/api/places') {
    const result = filterPlaces(request);
    return json({ total: result.length, places: result });
  }

  if (request.method === 'GET' && pathname.startsWith('/api/places/')) {
    const id = Number(pathname.split('/').pop());
    const place = places.find((item) => Number(item.id) === id);
    return place ? json(place) : json({ error: 'Place not found' }, 404);
  }

  if (request.method === 'GET' && pathname === '/api/reviews') {
    const placeId = Number(url.searchParams.get('placeId') || 0);
    const userId = url.searchParams.get('userId');

    let result = [...reviews];
    if (placeId) result = result.filter((review) => Number(review.placeId) === placeId);
    if (userId) result = result.filter((review) => review.userId === userId);

    result.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );

    return json(result);
  }

  // Persistent writes will be moved to Cloudflare D1 in the next migration step.
  // Returning a clear response is safer than pretending a JSON file is writable
  // inside a stateless Worker runtime.
  if (request.method !== 'GET' && pathname.startsWith('/api/')) {
    return json(
      {
        error: 'This API write operation is not enabled yet.',
        code: 'D1_MIGRATION_REQUIRED',
        message:
          'Read APIs are running on Cloudflare Workers. Persistent writes will use Cloudflare D1.',
      },
      503,
    );
  }

  return json({ error: 'API route not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
