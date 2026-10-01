import Supplier from "../models/Supplier.js";

export const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Supplier name is required",
      });
    }

    const supplier = await Supplier.create({
      name,
      phone,
      email,
      address,
      notes,
    });

    res.status(201).json({
      _id: supplier._id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
      active: supplier.active,
      createdAt: supplier.createdAt,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

export const getSuppliers = async (req, res) => {
  try {
    let suppliers;

    if (req.employee.role === "owner") {
      suppliers = await Supplier.find().sort({ name: 1 });
    } else {
      suppliers = await Supplier.find({ active: true })
        .select("name")
        .sort({ name: 1 });
    }

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch suppliers",
    });
  }
};