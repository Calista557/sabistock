import express from "express";
import {
  startCount,
  enterCounts,
  getCount,
  closeCount,
} from "../controllers/stockCountController.js";
import { requireLogin, requireRole } from "../middleware/auth.js";


const router = express.Router();

router.use(requireLogin);

router.post("/", startCount);
router.get("/:id", getCount);
router.patch("/:id/items", enterCounts);
router.post("/:id/close", closeCount);
router.post("/:id/close", requireRole("owner", "manager"), closeCount);

export default router;