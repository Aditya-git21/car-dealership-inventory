import { useEffect, useState } from 'react';
import { api, messageOf } from '../api';
import type { Session } from '../api';
import { EMPTY_FILTERS } from '../types';
import type { SearchFilters, Vehicle, VehicleInput } from '../types';
import Modal from './Modal';
import RestockForm from './RestockForm';
import SearchBar from './SearchBar';
import VehicleCard from './VehicleCard';
import VehicleForm from './VehicleForm';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; vehicle: Vehicle }
  | { type: 'restock'; vehicle: Vehicle }
  | null;

interface Toast {
  text: string;
  kind: 'ok' | 'error';
}

export default function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const isAdmin = session.user.role === 'ADMIN';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0); // bump to force a re-fetch
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const hasFilters = Object.values(filters).some((v) => v.trim() !== '');

  // Fetch vehicles when the filters change. The 300ms wait avoids one request per keystroke,
  // and "cancelled" stops an old, slow response from overwriting a newer one.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = hasFilters ? await api.searchVehicles(filters) : await api.listVehicles();
        if (!cancelled) {
          setVehicles(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(messageOf(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, hasFilters, reloadKey]);

  // Toasts disappear by themselves
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (text: string, kind: Toast['kind']) => setToast({ text, kind });
  const replace = (updated: Vehicle) =>
    setVehicles((list) => list.map((v) => (v.id === updated.id ? updated : v)));

  async function handlePurchase(vehicle: Vehicle) {
    setBusyId(vehicle.id);
    try {
      const updated = await api.purchase(vehicle.id);
      replace(updated);
      notify(`Purchased ${updated.make} ${updated.model}`, 'ok');
    } catch (err) {
      notify(messageOf(err), 'error');
      setReloadKey((k) => k + 1); // stock may have changed, e.g. someone bought the last one
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`)) return;
    setBusyId(vehicle.id);
    try {
      await api.deleteVehicle(vehicle.id);
      setVehicles((list) => list.filter((v) => v.id !== vehicle.id));
      notify('Vehicle deleted', 'ok');
    } catch (err) {
      notify(messageOf(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  // The forms below throw on failure, so each form can show the error inside itself
  async function handleSave(input: VehicleInput) {
    if (modal?.type === 'edit') {
      replace(await api.updateVehicle(modal.vehicle.id, input));
      notify('Vehicle updated', 'ok');
    } else {
      await api.createVehicle(input);
      setReloadKey((k) => k + 1);
      notify('Vehicle added', 'ok');
    }
    setModal(null);
  }

  async function handleRestock(vehicle: Vehicle, amount: number) {
    replace(await api.restock(vehicle.id, amount));
    notify(`Added ${amount} to ${vehicle.make} ${vehicle.model}`, 'ok');
    setModal(null);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-bold">Car Dealership Inventory</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{session.user.email}</span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {session.user.role}
            </span>
            <button onClick={onLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <SearchBar filters={filters} onChange={setFilters} />

        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={() => setModal({ type: 'add' })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Add vehicle
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-slate-500">Loading vehicles…</p>
        ) : vehicles.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-500">
            No vehicles found.{hasFilters && ' Try clearing the filters.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                isAdmin={isAdmin}
                busy={busyId === v.id}
                onPurchase={handlePurchase}
                onEdit={(vehicle) => setModal({ type: 'edit', vehicle })}
                onDelete={handleDelete}
                onRestock={(vehicle) => setModal({ type: 'restock', vehicle })}
              />
            ))}
          </div>
        )}
      </main>

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <Modal title={modal.type === 'add' ? 'Add vehicle' : 'Edit vehicle'} onClose={() => setModal(null)}>
          <VehicleForm
            initial={modal.type === 'edit' ? modal.vehicle : null}
            onSubmit={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'restock' && (
        <Modal title="Restock vehicle" onClose={() => setModal(null)}>
          <RestockForm
            vehicle={modal.vehicle}
            onSubmit={(amount) => handleRestock(modal.vehicle, amount)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
