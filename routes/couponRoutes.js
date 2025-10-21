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
  const Coupon = require("../models/CouponSchema")
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

// Get all coupons
router.get("/", checkAdminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render("coupon_form", {
      coupons,
      coupon: null,
    });
  } catch (err) {
    console.error("Error fetching coupons:", err);
    res.redirect("/coupons");
  }
});

// Add new coupon form
router.get("/add", checkAdminAuth, (req, res) => {
  res.render("coupon_form", {
    coupons: [],
    coupon: null,
  });
});

// Edit coupon form
router.get("/edit/:id", checkAdminAuth, async (req, res) => {
  try {
    const [coupons, coupon] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }),
      Coupon.findById(req.params.id),
    ]);

    if (!coupon) return res.redirect("/coupons");

    res.render("coupon_form", {
      coupons,
      coupon,
    });
  } catch (err) {
    console.error("Error in edit route:", err);
    res.redirect("/coupons");
  }
});

// Toggle coupon active status
router.post("/toggle-active/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.redirect("/coupons");

    coupon.active = !coupon.active;
    await coupon.save();

    res.redirect("/coupons");
  } catch (err) {
    console.error("Error toggling coupon status:", err);
    res.redirect("/coupons");
  }
});

// Delete coupon
router.post("/delete/:id", async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.redirect("/coupons");
  } catch (err) {
    console.error("Error deleting coupon:", err);
    res.redirect("/coupons");
  }
});

// Create new coupon
router.post("/create", async (req, res) => {
  try {
    const { code, discountType, discountValue, expiryDate, active, useonce } = req.body;

    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.redirect("/coupons");
    }

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.redirect("/coupons");
    }

    const coupon = new Coupon({
      code,
      discountType,
      discountValue: Number(discountValue),
      expiryDate: new Date(expiryDate),
      active: active === "on",
      useonce: useonce === "on",
    });

    await coupon.save();
    res.redirect("/coupons");
  } catch (err) {
    console.error("Error creating coupon:", err);
    res.redirect("/coupons");
  }
});

// Update existing coupon
router.post("/update/:id", async (req, res) => {
  try {
    const { code, discountType, discountValue, expiryDate, active, useonce } = req.body;
    const couponId = req.params.id;

    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.redirect(`/coupons/edit/${couponId}`);
    }

    const existingCoupon = await Coupon.findOne({
      code,
      _id: { $ne: couponId },
    });
    if (existingCoupon) {
      return res.redirect(`/coupons/edit/${couponId}`);
    }

    await Coupon.findByIdAndUpdate(
      couponId,
      {
        code,
        discountType,
        discountValue: Number(discountValue),
        expiryDate: new Date(expiryDate),
        active: active === "on",
        useonce: useonce === "on",
      },
      { new: true }
    );

    res.redirect("/coupons");
  } catch (err) {
    console.error("Error updating coupon:", err);
    res.redirect(`/coupons/edit/${req.params.id}`);
  }
});

module.exports = router;