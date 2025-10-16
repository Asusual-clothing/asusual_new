const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Buy 3 Get 1 Free"
  
  // 👇 Now supports multiple products (T-shirts, hoodies, etc.)
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }],

  minQuantity: { type: Number, required: true }, // e.g. 3 (buy 3)
  
  offerType: {
    type: String,
    enum: ['free_item', 'flat_discount', 'percentage_discount'],
    required: true
  },

  offerValue: { type: Number }, // e.g. 499 or 40 (%)
  
  // For "get 1 free" or "get X product free"
  freeProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },

  // Optional: allow multiple free items
  freeProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  expiryDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Offer', OfferSchema);
