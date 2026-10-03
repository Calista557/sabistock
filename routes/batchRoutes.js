import express from 'express';
import { getExpiringBatches } from '../controllers/batchController.js';
import { requireLogin, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/expiring', requireLogin, requireRole('owner', 'manager'), getExpiringBatches);

export default router;