import express from "express";

import { createCustomer } from "../controllers/customerController.js";

import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post("/", createCustomer);

export default router;