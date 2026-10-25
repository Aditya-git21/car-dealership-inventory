import { useState } from 'react';
import type { FormEvent } from 'react';
import { messageOf } from '../api';
import type { Vehicle } from '../types';
import Field from './Field';

interface Props {
  vehicle: Vehicle;
  onSubmit: (amount: number) => Promise<void>;
  onCancel: () => void;
}

export default function RestockForm({ vehicle, onSubmit, onCancel }: Props) {
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(Number(amount));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-slate-600">
        {vehicle.make} {vehicle.model}: currently {vehicle.quantity} in stock
      </p>
      <Field label="Units to add" type="number" required min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Adding…' : 'Add stock'}
        </button>
      </div>
    </form>
  );
}
