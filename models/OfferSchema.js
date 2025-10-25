const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }],

  minQuantity: { type: Number, required: true },
  
  offerType: {
    type: String,
    enum: ['free_item', 'flat_discount', 'percentage_discount'],
    required: true
  },

  offerValue: { type: Number }, 
  
  freeProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },


  freeProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  expiryDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Offer', OfferSchema);
