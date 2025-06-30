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
    console.log("Processing order request...");
    const userId = req.user?._id || req.session.userId;
    const { shippingAddress } = req.body;

    if (!userId) {
      console.error("Authentication failed - no user ID found");
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon");

    if (!cart) {
      console.error("No cart found for user:", userId);
      return res.status(400).json({ success: false, message: "Cart not found" });
    }

    if (cart.items.length === 0) {
      console.error("Empty cart for user:", userId);
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Check coupon validity if applied
    if (cart.appliedCoupon?.useonce) {
      const user = await User.findById(userId);
      if (user.useoncecoupon.includes(cart.appliedCoupon.code)) {
        console.error("Coupon already used by user:", cart.appliedCoupon.code);
        return res.status(400).json({
          success: false,
          message: "This coupon can only be used once per user and has already been used",
        });
      }
    }

    // Calculate order totals
    const subtotal = cart.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    const deliverySetting = await DeliveryCost.findOne({});
    const shippingFee = deliverySetting ? deliverySetting.cost : 0;
    const discountAmount = cart.discountAmount || 0;
    const totalAmount = subtotal - discountAmount + shippingFee;

    console.log("Order totals calculated:", {
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount
    });

    // Create pending order record
    const pendingOrder = await createOrder(
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

    console.log("Pending order created:", pendingOrder._id);

    // Generate payment request
    const merchantOrderId = uuidv4();
    const redirectUrl = `${process.env.BASE_URL}/payment/payment-callback?merchantOrderId=${merchantOrderId}&orderId=${pendingOrder._id}`;

    const amountInPaise = Math.round(totalAmount * 100);  

    console.log("Preparing payment request:", {
      merchantOrderId,
      amountInPaise,
      redirectUrl
    });

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise.toString())
      .redirectUrl(redirectUrl)
      .build();

    const response = await client.pay(request);
    console.log("Payment gateway response:", response);

    // Store payment ID with the order
    pendingOrder.paymentId = merchantOrderId;
    await pendingOrder.save();

    console.log("Order processed successfully, redirecting to payment gateway");
    return res.json({
      success: true,
      checkoutPageUrl: response.redirectUrl,
      orderId: pendingOrder._id,
      message: "Redirect to payment gateway",
    });

  } catch (error) {
    console.error("🔥 Error processing order:", {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
      userId: req.user?._id || req.session.userId
    });
    res.status(500).json({
      success: false,
      message: "An error occurred while processing the order",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Payment Status Callback
router.get("/payment-callback", async (req, res) => {
  try {
    const { merchantOrderId, orderId } = req.query;

    console.log("🟡 Callback triggered:", { merchantOrderId, orderId });

    if (!merchantOrderId || !orderId) {
      console.error("Missing parameters in callback");
      return res.status(400).send("Missing parameters");
    }

    // Verify payment with PhonePe
    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;
    console.log("🟢 Payment status from PhonePe:", status);

    const order = await Order.findById(orderId);
    if (!order) {
      console.error("Order not found:", orderId);
      return res.status(404).send("Order not found");
    }

    if (status === "COMPLETED") {
      order.paymentStatus = "Paid";
      await order.save();
      console.log("✅ Order marked as Paid");

      // Size mapping
      const sizeMap = {
        XS: 'xsmall',
        S: 'small',
        M: 'medium',
        L: 'large',
        XL: 'xlarge',
        XXL: 'xxlarge'
      };

      // Reduce stock for each product in the order
      for (const item of order.items) {
        const { product, size, quantity } = item;
        const mappedSize = sizeMap[size.toUpperCase()];
        const sizeKey = `sizes.${mappedSize}`;

        console.log("🔧 Attempting to reduce stock:", {
          product,
          originalSize: size,
          mappedSize,
          quantity,
          sizeKey
        });

        if (!mappedSize) {
          console.warn(`⚠️ Unknown size '${size}'. Skipping product: ${product}`);
          continue;
        }

        const result = await Product.updateOne(
          { _id: product, [sizeKey]: { $gte: quantity } },
          { $inc: { [sizeKey]: -quantity } }
        );

        if (result.modifiedCount === 0) {
          console.warn(`⚠️ Stock not reduced for ${product} - not enough quantity or invalid size`);
        } else {
          console.log(`✅ Stock reduced for product ${product} - size ${mappedSize}`);
        }
      }

      // Clear cart
      const cart = await Cart.findOne({ user: order.user });
      if (cart) {
        await cart.deleteOne();
        console.log("🗑️ Cart cleared after successful payment");
      }

      return res.redirect(`${process.env.BASE_URL}/payment/order-success/${orderId}`);
    } else {
      order.paymentStatus = "Failed";
      await order.save();
      console.log("❌ Payment failed - order updated");

      return res.redirect(`${process.env.BASE_URL}/payment/order-failed/${orderId}`);
    }
  } catch (error) {
    console.error("🔥 Error in payment callback:", {
      message: error.message,
      stack: error.stack,
      queryParams: req.query
    });
    return res.redirect(`${process.env.BASE_URL}/payment-error`);
  }
});

// Helper function to create an order
async function createOrder(
  userId,
  cart,
  subtotal,
  discountAmount,
  shippingFee,
  totalAmount,
  paymentMethod,
  paymentStatus,
  shippingAddress
) {
  try {
    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      priceAtPurchase: item.product.price,
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
  } catch (error) {
    console.error("Error in createOrder helper:", error);
    throw error;
  }
}

// Route to handle payment success
router.get("/order-success/:orderId", (req, res) => {
  res.render("order-success", { orderId: req.params.orderId });
});

// Route to handle payment failure
router.get("/payment/order-failed/:orderId", (req, res) => {
  res.render("order-failed", { orderId: req.params.orderId });
});

module.exports = router;