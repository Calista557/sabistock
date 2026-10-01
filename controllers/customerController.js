import Customer from "../models/Customer.js";

export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Customer name is required",
      });
    }

    const customer = await Customer.create({
      name,
      phone,
      email,
      address,
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      message: error.message,
    });
  }
};