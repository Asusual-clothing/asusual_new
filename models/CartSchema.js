const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false
      },
      quantity: {
        type: Number,
        required: true
      },
      size: {
        type: String,
        required: true
      },
      color: {
        type: String,
        required: true
      }
    }
  ],
  appliedCoupon: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'CouponType'
  },
  CouponType:{
    type:String,
    enum:['Coupon', 'Offer']
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  freeItem:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Product'
  },
  freeItemSize: {
  type: String,
  default: null,
},
  couponLocked: {
  type: Boolean,
  default: false
},

}, {
  timestamps: true,
  strictPopulate: false // To avoid population errors
});

module.exports = mongoose.model('Cart', CartSchema);