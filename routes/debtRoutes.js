import express from "express";

import { getDebts } from "../controllers/debtController.js";

import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.get("/", getDebts);

export default router;