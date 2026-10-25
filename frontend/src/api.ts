import type { SearchFilters, User, Vehicle, VehicleInput } from './types';

// Empty in dev (the Vite proxy handles /api). Set VITE_API_URL when deploying.
const BASE = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = 'dealership-session';

export interface Session {
  token: string;
  user: User;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

// ---- session kept in the browser so a refresh doesn't log you out ----
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// App registers this so any 401 (expired token) sends the user back to login
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = loadSession()?.token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // A 401 while holding a token means it expired or is invalid
    if (res.status === 401 && token) {
      clearSession();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, data.error ?? 'Something went wrong');
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    request<Session>('/api/auth/login', { method: 'POST', body: { email, password } }),

  listVehicles: () => request<Vehicle[]>('/api/vehicles'),
  searchVehicles: (filters: SearchFilters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    return request<Vehicle[]>(`/api/vehicles/search?${params}`);
  },
  createVehicle: (input: VehicleInput) =>
    request<Vehicle>('/api/vehicles', { method: 'POST', body: input }),
  updateVehicle: (id: number, input: Partial<VehicleInput>) =>
    request<Vehicle>(`/api/vehicles/${id}`, { method: 'PUT', body: input }),
  deleteVehicle: (id: number) => request<void>(`/api/vehicles/${id}`, { method: 'DELETE' }),

  purchase: (id: number) => request<Vehicle>(`/api/vehicles/${id}/purchase`, { method: 'POST' }),
  restock: (id: number, amount: number) =>
    request<Vehicle>(`/api/vehicles/${id}/restock`, { method: 'POST', body: { amount } }),
};
