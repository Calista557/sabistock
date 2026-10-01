import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
    type: Number,
    required: true,
    min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "An order needs at least one item",
      },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "transfer", "card", "credit"],
      required: true,
    },
    status: {
    type: String,
     enum: ["completed", "voided"],
     default: "completed",
    },

    voidedAt: {
  type: Date,
    },

    voidedBy: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "Employee",
    },

    voidReason: {
     type: String,
     trim: true,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    customer: {
     type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
    },
    payments: [
      {
        amount: { type: Number, required: true, min: 1 },
        method: {
          type: String,
          enum: ["cash", "transfer", "card", "credit"],
          required: true,
        },
        receivedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
    paidAt: { type: Date, default: Date.now },
      },
    ],
    clientId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Order", orderSchema);