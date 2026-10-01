import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";

export const createEmployee = async (req, res) => {
  try {
    const { name, role, pin } = req.body;

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res
        .status(400)
        .json({ message: "PIN must be 4 to 6 digits" });
    }

    const pinHash = await bcrypt.hash(String(pin), 10);

    const employee = await Employee.create({ name, role, pinHash });

    res.status(201).json({
      _id: employee._id,
      name: employee.name,
      role: employee.role,
      active: employee.active,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ active: true }).sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { employeeId, pin } = req.body;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee or PIN" });
    }

    const employee = await Employee.findById(employeeId).select("+pinHash");

    const valid =
      employee &&
      employee.active &&
      (await bcrypt.compare(String(pin), employee.pinHash));

    if (!valid) {
      return res.status(401).json({ message: "Invalid employee or PIN" });
    }

    const token = jwt.sign(
      { id: employee._id, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    res.json({
      message: "Login successful",
      token,
      employee: {
        _id: employee._id,
        name: employee.name,
        role: employee.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};