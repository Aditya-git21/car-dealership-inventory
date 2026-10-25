export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  role: Role;
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

export type VehicleInput = Omit<Vehicle, 'id'>;

// Filters are kept as text because they come straight from input boxes
export interface SearchFilters {
  make: string;
  model: string;
  category: string;
  minPrice: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  make: '',
  model: '',
  category: '',
  minPrice: '',
  maxPrice: '',
};
