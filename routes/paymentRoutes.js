const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require('uuid');
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require('pg-sdk-node');

// Models
const Product = require("../models/Product");
const User = require("../models/UserSchema");
const Cart = require("../models/CartSchema");
const Order = require("../models/OrderSchema");
const DeliveryCost = require("../models/Deliveryschema");
const Coupon = require("../models/CouponSchema");

// Initialize PhonePe client
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const clientVersion = 1;
const env = process.env.NODE_ENV === 'production' ? Env.PRODUCTION : Env.SANDBOX;
const client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);

// Integrated Payment and Order Placement Route
router.post("/process-order", async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;
    const { shippingAddress } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart not found or empty" });
    }

    if (cart.appliedCoupon?.useonce) {
      const user = await User.findById(userId);
      if (user.useoncecoupon.includes(cart.appliedCoupon.code)) {
        return res.status(400).json({ success: false, message: "This coupon can only be used once" });
      }
    }

    const subtotal = cart.items.reduce(
      (total, item) => total + item.product.price * item.quantity, 0
    );
    const deliverySetting = await DeliveryCost.findOne({});
    const shippingFee = deliverySetting ? deliverySetting.cost : 0;
    const discountAmount = cart.discountAmount || 0;
    const totalAmount = subtotal - discountAmount + shippingFee;

    // Try to find a recent pending order (within 10 mins)
    let pendingOrder = await Order.findOne({
      user: userId,
      paymentStatus: "Pending",
      cart: cart._id,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (!pendingOrder) {
      try {
        pendingOrder = await createOrder(
          userId,
          cart,
          subtotal,
          discountAmount,
          shippingFee,
          totalAmount,
          "ONLINE",
          "Pending",
          shippingAddress
        );
      } catch (err) {
        // Duplicate pending order — fetch the existing one
        if (err.code === 11000) {
          pendingOrder = await Order.findOne({
            user: userId,
            paymentStatus: "Pending",
            cart: cart._id
          });
        } else {
          throw err;
        }
      }
    }

    // Generate payment request
    const merchantOrderId = uuidv4();
    const redirectUrl = `${process.env.BASE_URL}/payment/payment-callback?merchantOrderId=${merchantOrderId}&orderId=${pendingOrder._id}`;
    const amountInPaise = Math.round(totalAmount * 100);

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise.toString())
      .redirectUrl(redirectUrl)
      .build();

    const response = await client.pay(request);

    pendingOrder.paymentId = merchantOrderId;
    await pendingOrder.save();

    return res.json({
      success: true,
      checkoutPageUrl: response.redirectUrl,
      orderId: pendingOrder._id,
      message: "Redirect to payment gateway",
    });

  } catch (error) {
    console.error("🔥 Error processing order:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Payment Status Callback
router.get("/payment-callback", async (req, res) => {
  try {
    const { merchantOrderId, orderId } = req.query;

    if (!merchantOrderId || !orderId) {
      return res.status(400).send("Missing parameters");
    }

    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send("Order not found");

    if (order.paymentStatus === "Paid") {
      return res.redirect(`${process.env.BASE_URL}/payment/order-success/${orderId}`);
    }

    if (status === "COMPLETED") {
      order.paymentStatus = "Paid";
      await order.save();

      const sizeMap = {
        XS: 'xsmall', S: 'small', M: 'medium',
        L: 'large', XL: 'xlarge', XXL: 'xxlarge'
      };

      for (const item of order.items) {
        const mappedSize = sizeMap[item.size?.toUpperCase()];
        const sizeKey = `sizes.${mappedSize}`;

        if (!mappedSize) continue;

        await Product.updateOne(
          { _id: item.product, [sizeKey]: { $gte: item.quantity } },
          { $inc: { [sizeKey]: -item.quantity } }
        );
      }

      const cart = await Cart.findOne({ user: order.user });
      if (cart) await cart.deleteOne();

      return res.redirect(`${process.env.BASE_URL}/payment/order-success/${orderId}`);
    } else {
      order.paymentStatus = "Failed";
      await order.save();
      return res.redirect(`${process.env.BASE_URL}/payment/order-failed/${orderId}`);
    }
  } catch (error) {
    console.error("🔥 Error in payment callback:", error);
    return res.redirect(`${process.env.BASE_URL}/payment-error`);
  }
});


// Helper function to create an order
async function createOrder(
  userId, cart, subtotal, discountAmount,
  shippingFee, totalAmount, paymentMethod,
  paymentStatus, shippingAddress
) {
  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    quantity: item.quantity,
    size: item.size,
    priceAtPurchase: item.product.price,
    color: item.color
  }));

  const newOrder = new Order({
    user: userId,
    cart: cart._id,
    items: orderItems,
    subtotal,
    discountAmount,
    shippingFee,
    totalAmount,
    paymentMethod,
    paymentStatus,
    shippingAddress,
    couponUsed: cart.appliedCoupon?._id,
  });

  if (cart.appliedCoupon?.useonce) {
    await User.findByIdAndUpdate(userId, {
      $addToSet: { useoncecoupon: cart.appliedCoupon.code },
    });
  }

  await newOrder.save();
  return newOrder;
}

// Route to handle payment success
router.get("/order-success/:orderId", (req, res) => {
  res.render("order-success", { orderId: req.params.orderId });
});

// Route to handle payment failure
router.get("/order-failed/:orderId", (req, res) => {
  res.render("order-failed", { orderId: req.params.orderId });
});

module.exports = router;