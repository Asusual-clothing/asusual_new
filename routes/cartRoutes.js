const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const User = require("../models/UserSchema");
const Cart = require("../models/CartSchema");
const Admin = require("../models/AdminSchema");
const CustomTshirt = require("../models/CustomTshirtSchema");
const CategoryCoupon = require("../models/categoryCoupon")
const Poster = require("../models/posterSchema");
const Order = require("../models/OrderSchema");
const Contact = require("../models/Contact");
const Notification = require("../models/Notification");
const Subscription = require("../models/subscription");
const Testimonial = require("../models/Testimonial");
const DeliveryCost = require("../models/Deliveryschema");
const Coupon = require("../models/CouponSchema");
const Offer = require("../models/OfferSchema")
const mongoose = require("mongoose")
// Middleware to attach user to request
const attachUser = async (req, res, next) => {
  try {
    const userId = req.session.userId || req.cookies.userId;
    req.user = userId ? await User.findById(userId, "name email phone createdAt") : null;
    res.locals.user = req.user;
    next();
  } catch (error) {
    console.error("User attachment error:", error);
    next(error);
  }
};


// View cart
router.get("/", async (req, res) => {
  try {
    let user = { name: "Guest" };
    let userId = null;

    if (req.user) {
      user = req.user;
      userId = req.user._id;
    } else {
      userId = req.session.userId;
      if (userId) {
        user = await User.findById(userId, "name");
      }
    }

    let cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon")
      .populate("freeItem");

    const deliveryCostDoc = await DeliveryCost.findOne().sort({ updatedAt: -1 });
    const deliveryCost = deliveryCostDoc ? deliveryCostDoc.cost : 5.0;

    let discountAmount = 0;
    const couponMessage = req.session.couponMessage;
    delete req.session.couponMessage;

    if (cart) {
      if (!cart.items) cart.items = [];

      // Add stock info for each cart item
      for (const item of cart.items) {
        if (item.product) {
          const sizeKey = item.size.toLowerCase();
          item.availableStock = item.product.sizes[sizeKey] || 0;
        }
      }

      // ✅ Fetch available sizes from product schema for the free item
      if (cart.freeItem) {
        const freeItemSizes = cart.freeItem.sizes || {};
        cart.freeItem.availableSizes = Object.keys(freeItemSizes).filter(
          (sizeKey) => freeItemSizes[sizeKey] > 0
        );

        // If all size counts are 0 → show "One Size"
        if (cart.freeItem.availableSizes.length === 0) {
          cart.freeItem.availableSizes = ["One Size"];
        }
      }

      if (cart.appliedCoupon) {
        const now = new Date();
        const userDoc = await User.findById(userId);

        const couponInvalid =
          !cart.appliedCoupon.active ||
          cart.appliedCoupon.expiryDate < now ||
          (cart.appliedCoupon.useonce &&
            userDoc.useoncecoupon.includes(cart.appliedCoupon.code));

        if (couponInvalid) {
          req.session.couponMessage = "The applied coupon is no longer valid.";
          cart.appliedCoupon = undefined;
          cart.discountAmount = 0;

          // Remove free item if coupon invalid
          if (cart.freeItem) {
            cart.freeItem = undefined;
          }

          await cart.save();
        } else {
          discountAmount = cart.discountAmount || 0;

          // Prevent removal of other items when freeItem exists
          cart.itemsLocked = !!cart.freeItem;
        }
      }

      // Remove orphaned free items if coupon removed
      if (!cart.appliedCoupon && cart.freeItem) {
        cart.freeItem = undefined;
        await cart.save();
      }
    } else {
      cart = { items: [] };
    }

    let subtotal = 0;
    if (cart.items && cart.items.length > 0) {
      subtotal = cart.items.reduce((sum, item) => {
        return sum + (item.product ? item.product.price * item.quantity : 0);
      }, 0);
    }

    const cartCount = cart.items ? cart.items.length : 0;

    res.render("User/cart", {
      user,
      cart,
      cartCount,
      deliveryCost,
      discountAmount,
      subtotal,
      message: couponMessage,
      error: null,
    });
  } catch (error) {
    console.error("Error loading cart:", error);
    res.status(500).render("cart", {
      user: { name: "Guest" },
      cart: { items: [] },
      cartCount: 0,
      deliveryCost: 5.0,
      discountAmount: 0,
      subtotal: 0,
      error: "Failed to load cart",
    });
  }
});


router.post("/apply-coupon", async (req, res) => {
  try {
    const { couponCode } = req.body;

    // ======================================================
    // ⚠️ Validate Input
    // ======================================================
    if (!couponCode || typeof couponCode !== "string" || couponCode.trim() === "") {
      req.session.couponMessage = "Please enter a valid code";
      return res.redirect("/cart");
    }

    const trimmedCode = couponCode.trim();
    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      req.session.couponMessage = "Please login to apply offers or coupons";
      return res.redirect("/signup");
    }

    // ======================================================
    // 🛒 Load User Cart
    // ======================================================
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon")
      .populate("freeItem");

    if (!cart || cart.items.length === 0) {
      req.session.couponMessage = "Your cart is empty";
      return res.redirect("/cart");
    }

    // Helper: cart subtotal
    const getSubtotal = () => {
      return cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    };

    // Helper: save and redirect
    const finalize = (message) => {
      req.session.couponMessage = message;
      return res.redirect("/cart");
    };

    // ======================================================
    // 🔍 FIND COUPON / CATEGORY COUPON / OFFER
    // ======================================================
    const now = new Date();

    const [coupon, categoryCouponRaw, offerRaw] = await Promise.all([
      Coupon.findOne({
        code: trimmedCode,
        active: true,
        expiryDate: { $gte: now }
      }),

      CategoryCoupon.findOne({
        name: trimmedCode,
        active: true,
        expiryDate: { $gte: now }
      }).populate("categoryId"),

      Offer.findOne({
        name: trimmedCode,
        active: true,
        expiryDate: { $gte: now }
      }).populate(["productIds", "freeProductId", "freeProductIds"])
    ]);

    let categoryCoupon = null;
    let offer = null;

    if (!coupon) categoryCoupon = categoryCouponRaw;
    if (!coupon && !categoryCouponRaw) offer = offerRaw;

    if (!coupon && !categoryCoupon && !offer) {
      return finalize("Invalid or expired code");
    }

    // ======================================================
    // 🎯 NORMAL COUPON LOGIC
    // ======================================================
    if (coupon) {
      const subtotal = getSubtotal();

      // Check one-time-use
      if (coupon.useonce) {
        const user = await User.findById(userId);
        if (user.useoncecoupon.includes(coupon.code)) {
          return finalize("This coupon can only be used once per customer");
        }
      }

      const discountAmount =
        coupon.discountType === "percentage"
          ? subtotal * (coupon.discountValue / 100)
          : Math.min(coupon.discountValue, subtotal);

      cart.appliedCoupon = coupon._id;
      cart.CouponType = "Coupon";
      cart.discountAmount = discountAmount;
      cart.couponLocked = false;
      cart.freeItem = undefined;

      await cart.save();

      return finalize(`Coupon "${coupon.code}" applied successfully!`);
    }

    // ======================================================
    // 🎯 CATEGORY COUPON LOGIC
    // ======================================================
    if (categoryCoupon) {
      const requiredCategoryId = String(categoryCoupon.categoryId._id);

      let eligibleSubtotal = 0;

      cart.items.forEach(item => {
        if (item.product && String(item.product.categoryType) === requiredCategoryId) {
          eligibleSubtotal += item.product.price * item.quantity;
        }
      });

      if (eligibleSubtotal <= 0) {
        return finalize("This coupon is not applicable to items in your cart.");
      }

      const discountAmount =
        categoryCoupon.offerType === "percentage_discount"
          ? eligibleSubtotal * (categoryCoupon.offerValue / 100)
          : Math.min(categoryCoupon.offerValue, eligibleSubtotal);

      cart.appliedCoupon = categoryCoupon._id;
      cart.CouponType = "CategoryCoupon";
      cart.discountAmount = discountAmount;
      cart.couponLocked = false;
      cart.freeItem = undefined;

      await cart.save();

      return finalize(
        `Category Coupon "${categoryCoupon.name}" applied successfully — You saved ₹${discountAmount.toFixed(
          2
        )} on ${categoryCoupon.categoryId.name}!`
      );
    }

    // ======================================================
    // 🎯 OFFER LOGIC
    // ======================================================

    const cartMap = new Map();
    for (const item of cart.items) {
      if (!item.product) continue;
      const pid = item.product._id.toString();
      const price = Number(item.product.price);

      if (!cartMap.has(pid)) {
        cartMap.set(pid, { totalQty: 0, price });
      }
      cartMap.get(pid).totalQty += item.quantity;
    }

    const missingRequired = [];
    const matchedEntries = [];

    for (const p of offer.productIds) {
      const pid = p._id.toString();
      const entry = cartMap.get(pid);

      if (!entry || entry.totalQty <= 0) missingRequired.push(pid);
      else matchedEntries.push(entry);
    }

    if (missingRequired.length > 0) {
      return finalize("This offer requires specific products to be in the cart.");
    }

    const matchedQty = matchedEntries.reduce((s, e) => s + e.totalQty, 0);
    if (matchedQty < (offer.minQuantity || 0)) {
      return finalize(`Add at least ${offer.minQuantity} of the required items to avail this offer`);
    }

    const offerSubtotal = matchedEntries.reduce((s, e) => s + e.price * e.totalQty, 0);

    let discountAmount = 0;

    if (offer.offerType === "free_item") {
      if (!offer.freeProductId) {
        return finalize(`Offer "${offer.name}" has no free product configured.`);
      }
      cart.freeItem = offer.freeProductId._id;
      discountAmount = 0;
    } else if (offer.offerType === "flat_discount") {
      discountAmount = Math.min(offer.offerValue, offerSubtotal);
    } else if (offer.offerType === "percentage_discount") {
      discountAmount = offerSubtotal * (offer.offerValue / 100);
    }

    cart.appliedCoupon = offer._id;
    cart.CouponType = "Offer";
    cart.discountAmount = discountAmount;
    cart.couponLocked = true;

    await cart.save();

    return finalize(
      offer.offerType === "free_item"
        ? `Offer "${offer.name}" applied — you got a free item!`
        : `Offer "${offer.name}" applied — ₹${discountAmount} off!`
    );

  } catch (error) {
    console.error("Error applying coupon:", error);
    req.session.couponMessage = "Something went wrong while applying coupon";
    return res.redirect("/cart");
  }
});





router.use(attachUser);

// Add to cart
router.post("/add-to-cart", async (req, res) => {
  const { productId, quantity, size, action, color } = req.body;
  const userId = req.session.userId || req.cookies.userId;

  // 🔒 If user not logged in
  if (!userId) {
    req.flash("error_msg", "Please log in to add items to your cart");
    return res.redirect("/signup"); // Redirect to signup or login page
  }

  try {
    let cart = await Cart.findOne({ user: userId });

    if (cart) {
      // 🔍 Check if same product, size & color already exists
      const existingItem = cart.items.find(
        (item) =>
          item.product.toString() === productId &&
          item.size === size &&
          item.color === color
      );

      if (existingItem) {
        existingItem.quantity += parseInt(quantity, 10);
      } else {
        cart.items.push({
          product: productId,
          quantity: parseInt(quantity, 10),
          size,
          color,
        });
      }
      await cart.save();
    } else {
      // 🛒 Create new cart
      const newCart = new Cart({
        user: userId,
        items: [
          {
            product: productId,
            quantity: parseInt(quantity, 10),
            size,
            color,
          },
        ],
      });
      await newCart.save();
    }

    // ✅ Set flash and redirect
    req.flash("success_msg", "Item added to cart successfully!");
    const redirectUrl = action === "buy" ? "/cart" : `/products/${productId}`;

    // Save flash to session before redirect
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(redirectUrl);
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    req.flash("error_msg", "Something went wrong while adding to cart");
    res.redirect(`/products/${productId}`);
  }
});


router.get("/check-stock/:productId/:size", async (req, res) => {
  try {
    const { productId, size } = req.params;

    // Validate inputs
    if (!productId || !size) {
      return res.status(400).json({ error: 'Product ID and size are required' });
    }

    // Size short → full mapping
    const sizeMap = {
      xs: "xsmall",
      s: "small",
      m: "medium",
      l: "large",
      xl: "xlarge",
      xxl: "xxlarge"
    };

    const normalizedSize = size.toLowerCase();
    const sizeKey = sizeMap[normalizedSize] || normalizedSize;

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Debug logs
    console.log('Product sizes:', product.sizes);
    console.log('Requested sizeKey:', sizeKey);

    const availableStock = product.sizes?.[sizeKey] ?? 0;

    return res.json({
      success: true,
      availableStock,
      size: sizeKey,
      productName: product.name
    });
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ error: 'Error checking product stock' });
  }
});


// View cart
router.get("/", async (req, res) => {
  try {
    let user = { name: "Guest" };
    let userId = null;

    if (req.user) {
      user = req.user;
      userId = req.user._id;
    } else {
      userId = req.session.userId;
      if (userId) {
        user = await User.findById(userId, "name");
      }
    }

    let cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon")
      .populate("freeItem");

    const deliveryCostDoc = await DeliveryCost.findOne().sort({ updatedAt: -1 });
    const deliveryCost = deliveryCostDoc ? deliveryCostDoc.cost : 5.0;

    let discountAmount = 0;
    const couponMessage = req.session.couponMessage;
    delete req.session.couponMessage;

    if (cart) {
      if (!cart.items) cart.items = [];

      // Add stock info for each cart item
      for (const item of cart.items) {
        if (item.product) {
          const sizeKey = item.size.toLowerCase();
          item.availableStock = item.product.sizes[sizeKey] || 0;
        }
      }

      if (cart.appliedCoupon) {
        const now = new Date();
        const userDoc = await User.findById(userId);

        const couponInvalid =
          !cart.appliedCoupon.active ||
          cart.appliedCoupon.expiryDate < now ||
          (cart.appliedCoupon.useonce &&
            userDoc.useoncecoupon.includes(cart.appliedCoupon.code));

        if (couponInvalid) {
          req.session.couponMessage = "The applied coupon is no longer valid.";
          cart.appliedCoupon = undefined;
          cart.discountAmount = 0;

          // Remove free item if coupon invalid
          if (cart.freeItem) {
            cart.freeItem = undefined;
          }

          await cart.save();
        } else {
          discountAmount = cart.discountAmount || 0;

          // Prevent removal of other items when freeItem exists
          cart.itemsLocked = !!cart.freeItem;
        }
      }

      // Remove orphaned free items if coupon removed
      if (!cart.appliedCoupon && cart.freeItem) {
        cart.freeItem = undefined;
        await cart.save();
      }
    } else {
      cart = { items: [] };
    }

    let subtotal = 0;
    if (cart.items && cart.items.length > 0) {
      subtotal = cart.items.reduce((sum, item) => {
        return sum + (item.product ? item.product.price * item.quantity : 0);
      }, 0);
    }

    const cartCount = cart.items ? cart.items.length : 0;

    res.render("User/cart", {
      user,
      cart,
      cartCount,
      deliveryCost,
      discountAmount,
      subtotal,
      message: couponMessage,
      error: null,
    });
  } catch (error) {
    console.error("Error loading cart:", error);
    res.status(500).render("cart", {
      user: { name: "Guest" },
      cart: { items: [] },
      cartCount: 0,
      deliveryCost: 5.0,
      discountAmount: 0,
      subtotal: 0,
      error: "Failed to load cart",
    });
  }
});







// Remove coupon
router.get("/remove-coupon", async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;
    if (!userId) {
      req.session.couponMessage = "Not authorized";
      return res.redirect("/signup");
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      req.session.couponMessage = "Cart not found";
      return res.redirect("/cart");
    }

    if (!cart.appliedCoupon && !cart.appliedOffer) {
      req.session.couponMessage = "No offer or coupon applied";
      return res.redirect("/cart");
    }

    // Remove free item if exists
    if (cart.freeItem) {
      cart.items = cart.items.filter(
        (item) => !item.isFree && item.product.toString() !== cart.freeItem.toString()
      );
    }

    cart.appliedCoupon = null;
    cart.appliedOffer = null;
    cart.freeItem = null;
    cart.discountAmount = 0;
    cart.couponLocked = false;

    await cart.save();

    req.session.couponMessage = "Coupon/offer removed successfully";
    res.redirect("/cart");
  } catch (error) {
    console.error("Error removing coupon:", error);
    req.session.couponMessage = "Failed to remove coupon/offer";
    res.redirect("/cart");
  }
});


// Update quantity
router.post("/update-quantity", async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;
    let userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId && item.size === size
    );

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    if (quantity > 0) {
      cart.items[itemIndex].quantity = quantity;
    } else {
      cart.items.splice(itemIndex, 1);
    }

    await cart.save();
    res.json({ success: true, cart });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).json({ success: false, message: "Error updating cart" });
  }
});
// Save selected size for free item
router.post("/update-freeitem-size", async (req, res) => {
  try {
    const { cartId, size } = req.body;
    console.log("caled=>", cartId)
    console.log("=>", size)
    if (!cartId || !size) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    await Cart.findByIdAndUpdate(cartId, { freeItemSize: size });
    return res.json({ success: true, message: "Free item size updated successfully" });
  } catch (error) {
    console.error("Error updating free item size:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.post("/remove-item", async (req, res) => {
  try {
    const { productId, size } = req.body;
    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    // 🔒 Prevent item removal if couponLocked
    if (cart.couponLocked && cart.freeItem) {
      const itemToRemove = cart.items.find(
        (i) => i.product.toString() === productId && i.size === size
      );
      console.log(itemToRemove)
      if (itemToRemove && !itemToRemove.isFree) {
        return res.status(400).json({
          success: false,
          message: "Cannot remove items while an active offer requires them.",
        });
      }
    }
    cart.items = cart.items.filter(
      (item) => !(item.product.toString() === productId && item.size === size)
    );

    await cart.save();
    res.json({ success: true, cart });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ success: false, message: "Error removing item from cart" });
  }
});





module.exports = router;
