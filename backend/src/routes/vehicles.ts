import { Router } from 'express';
import { Db } from '../db';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  parseId,
  listVehicles,
  searchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  purchaseVehicle,
  restockVehicle,
} from '../services/vehicleService';

export function vehicleRoutes(db: Db) {
  const router = Router();

  // Every vehicle route needs a valid token
  router.use(authenticate);

  router.get('/', (_req, res) => {
    res.json(listVehicles(db));
  });

  // Keep fixed paths like /search above any '/:id' route, or "search" gets read as an id
  router.get('/search', (req, res) => {
    res.json(searchVehicles(db, req.query));
  });

  router.post('/', (req, res) => {
    res.status(201).json(createVehicle(db, req.body));
  });

  router.put('/:id', (req, res) => {
    res.json(updateVehicle(db, parseId(req.params.id), req.body));
  });

  // Admin only: authenticate (above) runs first, then requireAdmin
  router.delete('/:id', requireAdmin, (req, res) => {
    deleteVehicle(db, parseId(req.params.id));
    res.status(204).send();
  });
    // Any logged-in user can buy
  router.post('/:id/purchase', (req, res) => {
    res.json(purchaseVehicle(db, parseId(req.params.id)));
  });

  // Admin only
  router.post('/:id/restock', requireAdmin, (req, res) => {
    res.json(restockVehicle(db, parseId(req.params.id), req.body?.amount));
  });

  return router;
}
