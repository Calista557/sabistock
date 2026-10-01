import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

export const requireLogin = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Please log in" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await Employee.findById(payload.id);
    if (!employee || !employee.active) {
      return res.status(401).json({ message: "Please log in" });
    }

    req.employee = employee;
    next();
  } catch (err) {
    res.status(401).json({ message: "Please log in" });
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.employee.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do this" });
    }
    next();
  };

  export const allowFirstSetup = async (req, res, next) => {
  try {
    const total = await Employee.countDocuments();

    if (total === 0) {
      return next();
    }

    requireLogin(req, res, () => requireRole("owner")(req, res, next));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};