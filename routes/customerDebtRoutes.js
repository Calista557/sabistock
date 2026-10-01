import express from "express";

import { getCustomerDebtTotals } from "../controllers/customerDebtController.js";

import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.get("/", getCustomerDebtTotals);

export default router;