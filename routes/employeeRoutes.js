import express from "express";
import {
  createEmployee,
  getEmployees,
  login,
} from "../controllers/employeeController.js";
import { allowFirstSetup } from "../middleware/auth.js";

const router = express.Router();

router.post("/", allowFirstSetup, createEmployee);
router.get("/", getEmployees);
router.post("/login", login);

export default router;