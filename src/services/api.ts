import { Place, Category, ProvinceItem, Review, PendingPlace, User } from '../types';
import { getFirebaseIdToken, getFirebaseAuth } from './firebase';

async function getAuthHeaders(includeContentType = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const idToken = await getFirebaseIdToken();
    const currentAuth = getFirebaseAuth();
    const firebaseUser = currentAuth?.currentUser;

    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    if (firebaseUser) {
      headers['x-user-id'] = firebaseUser.uid;
    }
  } catch (e) {
    console.error('Failed to get Firebase ID token:', e);
  }

  return headers;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  let message = fallback;

  try {
    const body = await res.json();
    if (typeof body?.error === 'string') message = body.error;
    if (typeof body?.code === 'string') message += ` (${body.code})`;
  } catch {
    // Keep the fallback message when the server does not return JSON.
  }

  throw new Error(`${message} [HTTP ${res.status}]`);
}

export const api = {
  async getPlaces(params: {
    q?: string;
    category?: string;
    region?: string;
    province?: string;
    minRating?: number;
    sort?: 'rating' | 'popular' | 'name';
    featured?: boolean;
    popular?: boolean;
    recommended?: boolean;
    limit?: number;
  } = {}): Promise<{ total: number; places: Place[] }> {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.region && params.region !== 'all') query.append('region', params.region);
    if (params.province && params.province !== 'all') query.append('province', params.province);
    if (params.minRating) query.append('minRating', params.minRating.toString());
    if (params.sort) query.append('sort', params.sort);
    if (params.featured) query.append('featured', 'true');
    if (params.popular) query.append('popular', 'true');
    if (params.recommended) query.append('recommended', 'true');
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`/api/places?${query.toString()}`);
    if (!res.ok) return throwApiError(res, 'Failed to fetch places');
    return res.json();
  },

  async getPlace(id: number): Promise<Place> {
    const res = await fetch(`/api/places/${id}`);
    if (!res.ok) return throwApiError(res, 'Place not found');
    return res.json();
  },

  async createPlace(place: Partial<Place>): Promise<Place> {
    const res = await fetch('/api/places', {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(place),
    });
    if (!res.ok) return throwApiError(res, 'Failed to create place');
    return res.json();
  },

  async updatePlace(id: number, place: Partial<Place>): Promise<Place> {
    const res = await fetch(`/api/places/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(place),
    });
    if (!res.ok) return throwApiError(res, 'Failed to update place');
    return res.json();
  },

  async deletePlace(id: number): Promise<{
    success: boolean;
    message: string;
    submissionUpdated?: boolean;
    deletedAt?: string;
  }> {
    const res = await fetch(`/api/places/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to delete place');
    return res.json();
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch('/api/categories');
    if (!res.ok) return throwApiError(res, 'Failed to fetch categories');
    return res.json();
  },

  async getProvinces(): Promise<ProvinceItem[]> {
    const res = await fetch('/api/provinces');
    if (!res.ok) return throwApiError(res, 'Failed to fetch provinces');
    return res.json();
  },

  async getReviews(params: { placeId?: number; userId?: string } = {}): Promise<Review[]> {
    const query = new URLSearchParams();
    if (params.placeId) query.append('placeId', params.placeId.toString());
    if (params.userId) query.append('userId', params.userId);

    const res = await fetch(`/api/reviews?${query.toString()}`);
    if (!res.ok) return throwApiError(res, 'Failed to fetch reviews');
    return res.json();
  },

  async createReview(data: {
    placeId: number;
    rating: number;
    comment: string;
    userName?: string;
    userId?: string;
    userAvatar?: string;
    language?: string;
  }): Promise<Review> {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) return throwApiError(res, 'Failed to submit review');
    return res.json();
  },

  async deleteReview(id: string): Promise<void> {
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to delete review');
  },

  async getSubmissions(userId?: string): Promise<PendingPlace[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/submissions${query}`, {
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to fetch submissions');
    return res.json();
  },

  async submitPlace(data: Partial<PendingPlace>): Promise<PendingPlace> {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) return throwApiError(res, 'Failed to submit place');
    return res.json();
  },

  async approveSubmission(id: string): Promise<{ success: boolean; place: Place }> {
    const res = await fetch(`/api/submissions/${id}/approve`, {
      method: 'POST',
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to approve submission');
    return res.json();
  },

  async rejectSubmission(id: string): Promise<void> {
    const res = await fetch(`/api/submissions/${id}/reject`, {
      method: 'POST',
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to reject submission');
  },

  async getAdminStats(): Promise<{
    totalPlaces: number;
    pendingSubmissions: number;
    totalReviews: number;
    totalUsers: number;
    regionalStats: { north: number; central: number; northeast: number; south: number };
  }> {
    const res = await fetch('/api/admin/stats', {
      headers: await getAuthHeaders(false),
    });
    if (!res.ok) return throwApiError(res, 'Failed to fetch admin stats');
    return res.json();
  },

  async login(email: string): Promise<{ user: User; token: string }> {
    throw new Error(`Legacy API login is disabled. Use Firebase Auth instead (${email}).`);
  },

  async register(name: string, email: string, role?: 'admin' | 'user'): Promise<{ user: User; token: string }> {
    throw new Error(`Legacy API registration is disabled. Use Firebase Auth instead (${name}, ${email}, ${role || 'user'}).`);
  },

  async logout(): Promise<void> {
    return Promise.resolve();
  },

  async toggleFavorite(userId: string, placeId: number): Promise<{ favorites: number[] }> {
    const res = await fetch('/api/users/favorite', {
      method: 'POST',
      headers: await getAuthHeaders(true),
      body: JSON.stringify({ userId, placeId }),
    });
    if (!res.ok) return throwApiError(res, 'Failed to update favorite');
    return res.json();
  },
};