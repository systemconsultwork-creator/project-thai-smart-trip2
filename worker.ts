import placesData from './backend/data/places.json';
import categoriesData from './backend/data/categories.json';
import provincesData from './backend/data/provinces.json';
import reviewsData from './backend/data/reviews.json';
import pendingPlacesData from './backend/data/pendingPlaces.json';
import usersData from './backend/data/users.json';

type Place = Record<string, any>;
type Review = Record<string, any>;
type PendingPlace = Record<string, any>;
type User = Record<string, any>;

interface Env {
  ASSETS: Fetcher;
  // FIREBASE_WEB_API_KEY is the preferred runtime variable for the Worker.
  // VITE_FIREBASE_API_KEY remains as a backwards-compatible fallback.
  FIREBASE_WEB_API_KEY?: string;
  VITE_FIREBASE_API_KEY?: string;
  ADMIN_EMAIL?: string;
}

const places = placesData as Place[];
const categories = categoriesData as any[];
const provinces = provincesData as any[];
const reviews = reviewsData as Review[];
const pendingPlaces = pendingPlacesData as PendingPlace[];
const users = usersData as User[];

const DEFAULT_ADMIN_EMAIL = 'systemconsultwork@gmail.com';

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

/**
 * Cloudflare Worker cannot use firebase-admin directly.
 * We verify the Firebase ID token through Firebase Auth's
 * accounts:lookup endpoint, then compare the verified email
 * with the single designated admin email.
 */
async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return json(
      { error: 'Authentication required.', code: 'UNAUTHORIZED' },
      401,
    );
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const apiKey = env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY;

  if (!idToken || !apiKey) {
    return json(
      {
        error: 'Firebase authentication is not configured for the Worker runtime.',
        code: 'AUTH_CONFIG_ERROR',
        missing: !apiKey ? 'FIREBASE_WEB_API_KEY' : 'ID_TOKEN',
      },
      500,
    );
  }

  try {
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!verifyResponse.ok) {
      return json(
        { error: 'Invalid or expired authentication token.', code: 'INVALID_TOKEN' },
        401,
      );
    }

    const payload = (await verifyResponse.json()) as {
      users?: Array<{ email?: string; disabled?: boolean }>;
    };

    const verifiedUser = payload.users?.[0];
    const verifiedEmail = verifiedUser?.email?.trim().toLowerCase();
    const adminEmail = (env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();

    if (!verifiedEmail || verifiedUser?.disabled || verifiedEmail !== adminEmail) {
      return json(
        { error: 'Access denied. Administrator privileges required.', code: 'FORBIDDEN' },
        403,
      );
    }

    return null;
  } catch (error) {
    console.error('Cloudflare admin authentication failed:', error);
    return json(
      { error: 'Unable to verify administrator authentication.', code: 'AUTH_VERIFY_ERROR' },
      401,
    );
  }
}

async function handleApi(request: Request, env: Env): Promise<Response> {
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

  // Member/profile read endpoint. The admin dashboard also uses this
  // endpoint without userId to retrieve the moderation queue.
  if (request.method === 'GET' && pathname === '/api/submissions') {
    const userId = url.searchParams.get('userId');

    if (userId) {
      return json(
        pendingPlaces.filter((submission) => submission.submittedBy?.userId === userId),
      );
    }

    const adminError = await requireAdmin(request, env);
    if (adminError) return adminError;

    return json(pendingPlaces);
  }

  if (request.method === 'GET' && pathname === '/api/admin/stats') {
    const adminError = await requireAdmin(request, env);
    if (adminError) return adminError;

    const pendingCount = pendingPlaces.filter(
      (submission) => submission.status === 'pending',
    ).length;

    const regionalStats = {
      north: places.filter((place) => place.regionId === 'north').length,
      central: places.filter((place) => place.regionId === 'central').length,
      northeast: places.filter((place) => place.regionId === 'northeast').length,
      south: places.filter((place) => place.regionId === 'south').length,
    };

    return json({
      totalPlaces: places.length,
      pendingSubmissions: pendingCount,
      totalReviews: reviews.length,
      totalUsers: users.length,
      regionalStats,
    });
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
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
