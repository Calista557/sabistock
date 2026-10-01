import express from "express";
import {
  createEmployee,
  getEmployees,
  login,
  setEmployeeActive,
} from "../controllers/employeeController.js";
import { allowFirstSetup, requireLogin, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/", allowFirstSetup, createEmployee);
router.get("/", getEmployees);
router.post("/login", login);
router.patch(
  "/:id/active",
  requireLogin,
  requireRole("owner"),
  setEmployeeActive,
);


export default router;