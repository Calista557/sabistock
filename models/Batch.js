import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    batchCode: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

batchSchema.index({ product: 1, expiryDate: 1 });

export default mongoose.model("Batch", batchSchema);