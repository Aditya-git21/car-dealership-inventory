import type { Vehicle } from '../types';

interface Props {
  vehicle: Vehicle;
  isAdmin: boolean;
  busy: boolean; // true while a request for this vehicle is running
  onPurchase: (v: Vehicle) => void;
  onEdit: (v: Vehicle) => void;
  onDelete: (v: Vehicle) => void;
  onRestock: (v: Vehicle) => void;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function VehicleCard({ vehicle, isAdmin, busy, onPurchase, onEdit, onDelete, onRestock }: Props) {
  const outOfStock = vehicle.quantity === 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">{vehicle.make}</p>
          <h3 className="text-lg font-semibold">{vehicle.model}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {vehicle.category}
        </span>
      </div>

      <p className="mt-4 text-2xl font-bold">{money.format(vehicle.price)}</p>
      <p className={`mt-1 text-sm font-medium ${outOfStock ? 'text-red-600' : 'text-emerald-600'}`}>
        {outOfStock ? 'Out of stock' : `${vehicle.quantity} in stock`}
      </p>

      <button
        onClick={() => onPurchase(vehicle)}
        disabled={outOfStock || busy}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Purchase
      </button>

      {isAdmin && (
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 text-sm">
          <button
            onClick={() => onEdit(vehicle)}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            onClick={() => onRestock(vehicle)}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            Restock
          </button>
          <button
            onClick={() => onDelete(vehicle)}
            disabled={busy}
            className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
