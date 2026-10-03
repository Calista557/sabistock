import mongoose from 'mongoose';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';

// Decides where a sale of `quantity` units should come from.
// Order: unbatched stock first, then batches by earliest expiry (FEFO).
// Expired batches are never used. This function only reads data.
export const allocateStock = async (productId, quantity) => {
  const pid = new mongoose.Types.ObjectId(productId);
  const now = new Date();

  // Remaining per batch. Movements with no batch group under _id: null.
  const totals = await StockMovement.aggregate([
    { $match: { product: pid } },
    { $group: { _id: '$batch', remaining: { $sum: '$quantity' } } },
  ]);

  const unbatchedRow = totals.find((t) => t._id === null);
  const unbatched = Math.max(unbatchedRow ? unbatchedRow.remaining : 0, 0);

  const remainingByBatch = new Map(
    totals.filter((t) => t._id !== null).map((t) => [String(t._id), t.remaining])
  );

  const batches = await Batch.find({ product: pid, expiryDate: { $gte: now } })
    .sort({ expiryDate: 1 })
    .lean();

  const allocations = [];
  let left = quantity;

  const fromUnbatched = Math.min(left, unbatched);
  if (fromUnbatched > 0) {
    allocations.push({ batch: null, quantity: fromUnbatched });
    left -= fromUnbatched;
  }

  for (const b of batches) {
    if (left <= 0) break;
    const available = remainingByBatch.get(String(b._id)) || 0;
    const take = Math.min(left, available);
    if (take > 0) {
      allocations.push({ batch: b._id, quantity: take });
      left -= take;
    }
  }

  return { allocations, shortBy: left };
};