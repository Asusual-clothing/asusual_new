const express = require("express");
const router = express.Router();
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

// Middleware
const checkAdminAuth = async (req, res, next) => {
  try {
    const adminId = req.session.adminId || req.cookies.adminId;
    if (!adminId) return res.redirect("/admin/login");

    const admin = await Admin.findById(adminId);
    if (!admin) {
      req.session.destroy();
      res.clearCookie("adminId");
      return res.redirect("/admin/login");
    }

    req.admin = admin;
    res.locals.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    req.session.destroy();
    res.clearCookie("adminId");
    res.redirect("/admin/login");
  }
};

// Place order
router.post("/place-order", async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    if (cart.appliedCoupon?.useonce) {
      const user = await User.findById(userId);
      if (user.useoncecoupon.includes(cart.appliedCoupon.code)) {
        return res.status(400).json({
          success: false,
          message: "This coupon can only be used once per user and has already been used",
        });
      }
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      priceAtPurchase: item.product.price,
      color: item.color
    }));
    console.log("=>", orderItems)
    const subtotal = cart.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    const deliverySetting = await DeliveryCost.findOne({});
    const shippingFee = deliverySetting ? deliverySetting.cost : 0;
    const discountAmount = cart.discountAmount || 0;
    const totalAmount = subtotal - discountAmount + shippingFee;

    const newOrder = new Order({
      user: userId,
      cart: cart._id,
      items: orderItems,
      subtotal,
      discountAmount,
      shippingFee,
      totalAmount,
      paymentMethod: req.body.paymentMethod || "COD",
      paymentStatus: "Pending",
      shippingAddress: req.body.shippingAddress,
      couponUsed: cart.appliedCoupon?._id,
    });

    if (cart.appliedCoupon?.useonce) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { useoncecoupon: cart.appliedCoupon.code },
      });
    }

    await newOrder.save();

    cart.items = [];
    cart.appliedCoupon = null;
    cart.discountAmount = 0;
    await cart.save();

    res.json({
      success: true,
      orderId: newOrder._id,
      message: "Order created successfully",
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the order",
    });
  }
});

// Order confirmation
router.get("/confirmation/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "name price");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("order-confirmation", {
      user: req.user || { name: "Guest" },
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Error loading order details");
  }
});

// Admin view all orders
router.get("/", checkAdminAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "items.product",
        select: "name images price",
        options: { allowNull: true },
      })
      .populate({
        path: "freeItem",
        select: "name images price",
      })
      .sort({ createdAt: -1 })
      .lean();

    orders.forEach((order) => {
      order.items = order.items.map((item) => {
        if (!item.product) {
          item.product = {
            name: "Product not available",
            images: [],
          };
        }
        return item;
      });
    });

    res.render("order", { orders });
  } catch (error) {
    console.error("Order fetch error:", error);
    res.status(500).render("error", {
      message: "Failed to load orders",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});


// User view all orders
router.get("/all-orders", async (req, res) => {
  if (!req.user) {
    return res.send(`
      <script>
        alert('Please log in to view your orders');
        window.location.href = '/auth/signup';
      </script>
    `);
  }

  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "items.product",
        select: "name images price",
        model: "Product",
      })
      .populate({
        path: "freeItem",
        select: "name images price",
        model: "Product",
      });

    const ordersWithStatus = orders.map((order) => {
      const hasDeletedProducts = order.items.some((item) => !item.product);
      return {
        ...order.toObject(),
        hasDeletedProducts,
      };
    });

    res.render("userallorders", {
      orders: ordersWithStatus,
      user: req.user,
      cartCount: req.session.cartCount || 0,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("error", { message: "Error fetching your orders" });
  }
});


// DELETE route for order deletion
router.post('/delete/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Find and delete the order
    const deletedOrder = await Order.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      req.flash('error', 'Order not found');
      return res.redirect('/orders');
    }

    req.flash('success', 'Order deleted successfully');
    res.redirect('/orders');
  } catch (error) {
    console.error('Error deleting order:', error);
    req.flash('error', 'Error deleting order');
    res.redirect('/orders');
  }
});


// Order details (admin)
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name images price description")
      .populate("user", "name email")
      .populate("freeItem", "name images price description")
      .populate("offerUsed", "name offerType")
      .populate("couponUsed", "code discountType discountValue");

    if (!order) {
      return res.status(404).render("error", { message: "Order not found" });
    }

    res.render("order_detail", { order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).render("error", { message: "Server error fetching order details" });
  }
});



// User order details
router.get("/all-orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: "items.product",
        select: "name images price description",
        model: "Product",
      })
      .populate({
        path: "freeItem",
        select: "name images price description",
        model: "Product",
      });

    if (!order) {
      return res.status(404).render("error", {
        message: "Order not found",
        user: req.user,
      });
    }

    res.render("user-order_details", {
      order,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).render("error", {
      message: "Server error fetching order details",
      user: req.user,
    });
  }
});

// Update order status
router.post("/update-status/:id", async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.redirect("/orders");
  } catch (err) {
    console.error(err);
    res.status(500).send("Update failed");
  }
});

// Create order
router.post("/create", async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, amount, items } = req.body;
    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!shippingAddress || !paymentMethod || !amount || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const cart = await Cart.findOne({ user: userId }).populate("appliedCoupon");

    let discountAmount = 0;
    if (cart?.appliedCoupon) {
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      if (cart.appliedCoupon.discountType === "percentage") {
        discountAmount = subtotal * (cart.appliedCoupon.discountValue / 100);
      } else {
        discountAmount = Math.min(cart.appliedCoupon.discountValue, subtotal);
      }
    }

    const deliverySetting = await DeliveryCost.findOne({});
    const shippingFee = deliverySetting ? deliverySetting.cost : 0;

    const newOrder = new Order({
      user: userId,
      cart: cart._id,
      items: items.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        size: item.size,
        priceAtPurchase: item.price,
        color: item.color
      })),
      subtotal: amount + discountAmount - shippingFee,
      discountAmount,
      shippingFee,
      totalAmount: amount,
      paymentMethod,
      paymentStatus: "Pending",
      shippingAddress,
    });

    await newOrder.save();

    cart.items = [];
    cart.appliedCoupon = null;
    cart.discountAmount = 0;
    await cart.save();

    res.json({
      success: true,
      order: newOrder,
      customer: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});



module.exports = router;