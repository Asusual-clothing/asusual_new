const mongoose = require('mongoose');

const CategoryCouponSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true},
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  offerType: {
    type: String,
    enum: [ 'flat_discount', 'percentage_discount'],
    required: true
  },
  offerValue: { type: Number }, 
  expiryDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CategoryCoupon', CategoryCouponSchema);
