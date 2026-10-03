import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const getExpiringBatches = async (req, res) => {
  try {
    const days = req.query.days === undefined ? 30 : Number(req.query.days);

    if (!Number.isInteger(days) || days < 0 || days > 365) {
      return res
        .status(400)
        .json({ message: 'days must be a whole number from 0 to 365' });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * DAY_MS);

    // Batches that expire on or before the cutoff (this includes already expired ones)
    const batches = await Batch.find({ expiryDate: { $lte: cutoff } })
      .populate('product', 'name')
      .sort({ expiryDate: 1 })
      .lean();

    if (batches.length === 0) {
      return res.json({ days, count: 0, batches: [] });
    }

    // Remaining stock per batch = sum of signed movements linked to that batch
    const totals = await StockMovement.aggregate([
      { $match: { batch: { $in: batches.map((b) => b._id) } } },
      { $group: { _id: '$batch', remaining: { $sum: '$quantity' } } },
    ]);

    const remainingByBatch = new Map(
      totals.map((t) => [String(t._id), t.remaining])
    );

    const result = batches
      .map((b) => {
        const remaining = remainingByBatch.get(String(b._id)) || 0;
        const daysLeft = Math.ceil((new Date(b.expiryDate) - now) / DAY_MS);
        return {
          batchId: b._id,
          batchCode: b.batchCode,
          productId: b.product?._id,
          productName: b.product?.name,
          expiryDate: b.expiryDate,
          daysLeft,
          status: daysLeft < 0 ? 'expired' : 'expiring',
          remaining,
        };
      })
      .filter((b) => b.remaining > 0);

    res.json({ days, count: result.length, batches: result });
  } catch (error) {
    res.status(500).json({ message: 'Could not load expiring batches' });
  }
};