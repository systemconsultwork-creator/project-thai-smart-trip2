import places from '../backend/data/places.json';
import categories from '../backend/data/categories.json';
import provinces from '../backend/data/provinces.json';

interface Env {
  ASSETS: Fetcher;
}

type AnyRecord = Record<string, any>;

const allPlaces = places as AnyRecord[];
const allCategories = categories as AnyRecord[];
const allProvinces = provinces as AnyRecord[];

function text(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return [value.th, value.en, value.zh].filter(Boolean).join(' ');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
}

function getNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function api(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;

  if (request.method !== 'GET') {
    return json({
      error: 'This Worker + JSON deployment is read-only. Write operations still use the local Express backend.',
    }, 405);
  }

  if (url.pathname === '/api/health') {
    return json({ ok: true, mode: 'cloudflare-worker-json', places: allPlaces.length });
  }

  if (url.pathname === '/api/categories') {
    return json(allCategories);
  }

  if (url.pathname === '/api/provinces') {
    return json(allProvinces);
  }

  if (url.pathname === '/api/places') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const category = url.searchParams.get('category');
    const region = url.searchParams.get('region');
    const province = url.searchParams.get('province');
    const minRating = getNumber(url.searchParams.get('minRating'));
    const sort = url.searchParams.get('sort');
    const featured = url.searchParams.get('featured') === 'true';
    const popular = url.searchParams.get('popular') === 'true';
    const recommended = url.searchParams.get('recommended') === 'true';
    const limitParam = Number(url.searchParams.get('limit') || '0');

    let result = allPlaces.filter((place) => {
      const searchable = [
        text(place.name),
        text(place.province),
        text(place.category),
        place.categoryId,
        place.region,
        place.description,
        place.address,
      ].join(' ').toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (category && category !== 'all' && place.categoryId !== category) return false;
      if (region && region !== 'all' && place.region !== region) return false;

      if (province && province !== 'all') {
        const provinceId = place.provinceId || place.province?.id;
        const provinceText = text(place.province).toLowerCase();
        if (provinceId !== province && !provinceText.includes(province.toLowerCase())) return false;
      }

      const rating = getNumber(place.rating ?? place.averageRating);
      if (minRating && rating < minRating) return false;
      if (featured && !place.featured) return false;
      if (popular && !place.popular) return false;
      if (recommended && !place.recommended) return false;
      return true;
    });

    if (sort === 'rating') {
      result.sort((a, b) => getNumber(b.rating ?? b.averageRating) - getNumber(a.rating ?? a.averageRating));
    } else if (sort === 'popular') {
      result.sort((a, b) => getNumber(b.reviewCount ?? b.popularity ?? b.views) - getNumber(a.reviewCount ?? a.popularity ?? a.views));
    } else if (sort === 'name') {
      result.sort((a, b) => text(a.name).localeCompare(text(b.name)));
    }

    if (limitParam > 0) result = result.slice(0, limitParam);
    return json({ total: result.length, places: result });
  }

  const placeMatch = url.pathname.match(/^\/api\/places\/(\d+)$/);
  if (placeMatch) {
    const id = Number(placeMatch[1]);
    const place = allPlaces.find((item) => Number(item.id) === id);
    return place ? json(place) : json({ error: 'Place not found' }, 404);
  }

  return json({ error: 'API route not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apiResponse = await api(request);
    if (apiResponse) return apiResponse;
    return env.ASSETS.fetch(request);
  },
};
