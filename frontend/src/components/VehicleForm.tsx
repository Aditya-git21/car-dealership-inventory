import { useState } from 'react';
import type { FormEvent } from 'react';
import { messageOf } from '../api';
import type { Vehicle, VehicleInput } from '../types';
import Field from './Field';

interface Props {
  initial: Vehicle | null; // null = adding a new vehicle
  onSubmit: (input: VehicleInput) => Promise<void>;
  onCancel: () => void;
}

export default function VehicleForm({ initial, onSubmit, onCancel }: Props) {
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      // The server validates everything again, so its message is shown if anything is wrong
      await onSubmit({ make, model, category, price: Number(price), quantity: Number(quantity) });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Make" required value={make} onChange={(e) => setMake(e.target.value)} />
      <Field label="Model" required value={model} onChange={(e) => setModel(e.target.value)} />
      <Field label="Category" required value={category} onChange={(e) => setCategory(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price" type="number" required min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Field label="Quantity" type="number" required min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add vehicle'}
        </button>
      </div>
    </form>
  );
}
