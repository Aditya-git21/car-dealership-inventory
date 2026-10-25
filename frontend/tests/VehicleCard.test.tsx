import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VehicleCard from '../src/components/VehicleCard';
import type { Vehicle } from '../src/types';

const car: Vehicle = { id: 1, make: 'Toyota', model: 'Camry', category: 'Sedan', price: 25000, quantity: 3 };

function setup(overrides: Partial<{ vehicle: Vehicle; isAdmin: boolean; busy: boolean }> = {}) {
  const handlers = { onPurchase: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onRestock: vi.fn() };
  render(<VehicleCard vehicle={car} isAdmin={false} busy={false} {...overrides} {...handlers} />);
  return handlers;
}

describe('VehicleCard', () => {
  it('shows the vehicle details and stock', () => {
    setup();
    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Camry')).toBeInTheDocument();
    expect(screen.getByText('Sedan')).toBeInTheDocument();
    expect(screen.getByText('3 in stock')).toBeInTheDocument();
  });

  it('calls onPurchase with the vehicle when Purchase is clicked', async () => {
    const { onPurchase } = setup();
    await userEvent.click(screen.getByRole('button', { name: /purchase/i }));
    expect(onPurchase).toHaveBeenCalledWith(car);
  });

  it('disables Purchase and says "Out of stock" when quantity is 0', async () => {
    const { onPurchase } = setup({ vehicle: { ...car, quantity: 0 } });
    const button = screen.getByRole('button', { name: /purchase/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    await userEvent.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('disables Purchase while a request is in progress', () => {
    setup({ busy: true });
    expect(screen.getByRole('button', { name: /purchase/i })).toBeDisabled();
  });

  it('hides admin controls from normal users', () => {
    setup({ isAdmin: false });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows admin controls that call the right handlers', async () => {
    const { onEdit, onRestock, onDelete } = setup({ isAdmin: true });
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /restock/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onEdit).toHaveBeenCalledWith(car);
    expect(onRestock).toHaveBeenCalledWith(car);
    expect(onDelete).toHaveBeenCalledWith(car);
  });
});
