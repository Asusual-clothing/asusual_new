const express = require("express");
const router = express.Router();
const axios = require("axios");
  const Product = require("../models/Product");
  const User = require("../models/UserSchema");
  const Cart = require("../models/CartSchema");
  const Admin = require("../models/AdminSchema");
  const CustomTshirt = require("../models/CustomTshirtSchema");
  const Poster = require("../models/posterSchema");
  const Order = require("../models/OrderSchema");
  const Contact = require("../models/Contact");
  const Notification = require("../models/Notification");
  const Subscription = require("../models/subscription");
  const Testimonial = require("../models/Testimonial");
  const DeliveryCost = require("../models/Deliveryschema");
  const Coupon = require("../models/CouponSchema");

// Create Cashfree payment
router.post("/cashfree/create", async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;

    if (!orderId || !amount || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const txId = `TXN_${Date.now()}`;

    const payload = {
      order_id: orderId,
      order_amount: amount.toFixed(2),
      order_currency: "INR",
      customer_details: {
        customer_id: req.user ? req.user._id.toString() : "guest",
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName
      },
      return_url: `${process.env.BASE_URL}/payment/verify?order_id=${orderId}`,
      notify_url: `${process.env.BASE_URL}/payment/webhook`
    };

    const cashfreeUrl = 'https://api.cashfree.com/pg/orders'; 
    const headers = {
      'Content-Type': 'application/json',
      'x-client-id': process.env.CASHFREE_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
      'x-api-version': '2023-08-01'
    };

    const response = await axios.post(cashfreeUrl, payload, { headers });

    if (response.data && response.data.payment_session_id) {
      return res.json({
        success: true,
        payment_link: response.data.payment_session_id
      });
    } else {
      console.error('Cashfree response missing payment link:', response.data);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate payment link'
      });
    }

  } catch (error) {
    console.error('Error initiating Cashfree payment:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while initiating payment'
    });
  }
});

// Verify payment
router.get("/verify", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ success: false, message: "Order ID not provided" });
    }

    const order = await Order.findById(order_id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.paymentStatus = "Paid";
    order.status = "Processing";
    await order.save();

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
});

module.exports = router;