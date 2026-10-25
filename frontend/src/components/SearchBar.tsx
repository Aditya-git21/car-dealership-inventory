import type { ChangeEvent } from 'react';
import { EMPTY_FILTERS } from '../types';
import type { SearchFilters } from '../types';
import Field from './Field';

interface Props {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

export default function SearchBar({ filters, onChange }: Props) {
  const set = (key: keyof SearchFilters) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
      <Field label="Make" placeholder="Toyota" value={filters.make} onChange={set('make')} />
      <Field label="Model" placeholder="Camry" value={filters.model} onChange={set('model')} />
      <Field label="Category" placeholder="SUV" value={filters.category} onChange={set('category')} />
      <Field label="Min price" type="number" min={0} value={filters.minPrice} onChange={set('minPrice')} />
      <Field label="Max price" type="number" min={0} value={filters.maxPrice} onChange={set('maxPrice')} />
      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTERS)}
        className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  );
}
