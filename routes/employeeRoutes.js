import express from "express";
import {
  createEmployee,
  getEmployees,
  login,
} from "../controllers/employeeController.js";

const router = express.Router();

router.post("/", createEmployee);
router.get("/", getEmployees);
router.post("/login", login);

export default router;