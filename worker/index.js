import places from "../backend/data/places.json";
import categories from "../backend/data/categories.json";
import provinces from "../backend/data/provinces.json";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });

function filterPlaces(url) {
  let result = [...places];
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const category = url.searchParams.get("category");
  const region = url.searchParams.get("region");
  const province = url.searchParams.get("province");
  const minRating = Number(url.searchParams.get("minRating"));
  const sort = url.searchParams.get("sort");
  const limit = Number(url.searchParams.get("limit"));

  if (q) {
    result = result.filter((p) => {
      const values = [
        p.name?.th,
        p.name?.en,
        p.name?.zh,
        p.province?.th,
        p.province?.en,
        p.description?.th,
        p.description?.en,
      ];
      return values.some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });
  }

  if (category && category !== "all") {
    result = result.filter((p) => p.categoryId === category);
  }

  if (region && region !== "all") {
    result = result.filter((p) => p.regionId === region);
  }

  if (province && province !== "all") {
    result = result.filter(
      (p) => p.province?.th === province || p.province?.en === province
    );
  }

  if (Number.isFinite(minRating) && minRating > 0) {
    result = result.filter((p) => Number(p.rating || 0) >= minRating);
  }

  if (sort === "rating") {
    result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  } else if (sort === "popular") {
    result.sort(
      (a, b) => Number(b.reviewCount || 0) - Number(a.reviewCount || 0)
    );
  } else if (sort === "name") {
    result.sort((a, b) =>
      String(a.name?.th || "").localeCompare(String(b.name?.th || ""), "th")
    );
  }

  if (Number.isInteger(limit) && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
        },
      });
    }

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "thai-smart-trip-worker",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/categories") {
      return json(categories);
    }

    if (url.pathname === "/api/provinces") {
      return json(provinces);
    }

    if (url.pathname === "/api/places") {
      const result = filterPlaces(url);
      return json({ total: result.length, places: result });
    }

    const match = url.pathname.match(/^\/api\/places\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const place = places.find((p) => Number(p.id) === id);
      return place ? json(place) : json({ error: "Place not found" }, 404);
    }

    // Serve the Vite frontend from Cloudflare Workers Assets.
    return env.ASSETS.fetch(request);
  },
};
