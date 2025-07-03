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

router.use(attachUser);

// Add to cart
router.post("/add-to-cart", async (req, res) => {
  const { productId, quantity, size, action } = req.body;
  const userId = req.session.userId || req.cookies.userId;

  if (!userId) {
    return res.send(`
      <script>
        alert('Please log in to add item to cart');
        window.location.href = '/auth/signup';
      </script>
    `);
  }

  try {
    let cart = await Cart.findOne({ user: userId });

    if (cart) {
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId && item.size === size
      );

      if (existingItem) {
        existingItem.quantity += parseInt(quantity, 10);
      } else {
        cart.items.push({
          product: productId,
          quantity: parseInt(quantity, 10),
          size,
        });
      }
      await cart.save();
    } else {
      const newCart = new Cart({
        user: userId,
        items: [{ product: productId, quantity: parseInt(quantity, 10), size }],
      });
      await newCart.save();
    }

    const redirectUrl = action === "buy" ? "/cart" : `/products/${productId}`;
    res.send(`
      <script>
        alert('Item added to cart successfully');
        window.location.href = '${redirectUrl}';
      </script>
    `);
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.send(`
      <script>
        alert('Error adding item to cart');
      </script>
    `);
  }
});


router.get("/check-stock/:productId/:size", async (req, res) => {
  try {
    const { productId, size } = req.params;
    
    // Validate inputs
    if (!productId || !size) {
      return res.status(400).json({ error: 'Product ID and size are required' });
    }

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check stock for the selected size
    const sizeKey = size.toLowerCase();
    const availableStock = product.sizes[sizeKey] || 0;

    res.json({ 
      success: true,
      availableStock,
      size,
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
      .populate("appliedCoupon");

    const deliveryCostDoc = await DeliveryCost.findOne().sort({ updatedAt: -1 });
    const deliveryCost = deliveryCostDoc ? deliveryCostDoc.cost : 5.0;

    let discountAmount = 0;
    const couponMessage = req.session.couponMessage;
    delete req.session.couponMessage;

    if (cart) {
      if (!cart.items) cart.items = [];

      // Add stock information to each cart item
      for (const item of cart.items) {
        if (item.product) {
          // Get the available stock for the selected size
          const sizeKey = item.size.toLowerCase();
          item.availableStock = item.product.sizes[sizeKey] || 0;
        }
      }

      if (cart.appliedCoupon) {
        const now = new Date();
        const user = await User.findById(userId);

        if (
          !cart.appliedCoupon.active ||
          cart.appliedCoupon.expiryDate < now ||
          (cart.appliedCoupon.useonce &&
            user.useoncecoupon.includes(cart.appliedCoupon.code))
        ) {
          req.session.couponMessage = "The applied coupon is no longer valid";
          cart.appliedCoupon = undefined;
          cart.discountAmount = 0;
          await cart.save();
        } else {
          discountAmount = cart.discountAmount || 0;
        }
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
    
    res.render("cart", {
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

// Apply coupon
router.post("/apply-coupon", async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode || typeof couponCode !== "string" || couponCode.trim() === "") {
      req.session.couponMessage = "Please enter a valid coupon code";
      return res.redirect("/cart");
    }

    const trimmedCode = couponCode.trim();
    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      req.session.couponMessage = "Please login to apply coupons";
      return res.redirect("/auth/login");
    }

    const coupon = await Coupon.findOne({
      code: trimmedCode,
      active: true,
      expiryDate: { $gte: new Date() },
    });

    if (!coupon) {
      const expiredCoupon = await Coupon.findOne({
        code: trimmedCode,
        expiryDate: { $lt: new Date() },
      });

      if (expiredCoupon) {
        req.session.couponMessage = "This coupon has expired";
        return res.redirect("/cart");
      }

      const inactiveCoupon = await Coupon.findOne({
        code: trimmedCode,
        active: false,
      });

      if (inactiveCoupon) {
        req.session.couponMessage = "This coupon is no longer active";
        return res.redirect("/cart");
      }

      req.session.couponMessage = "Invalid coupon code";
      return res.redirect("/cart");
    }

    if (coupon.useonce) {
      const user = await User.findById(userId);
      if (user.useoncecoupon.includes(coupon.code)) {
        req.session.couponMessage = "This coupon can only be used once per customer";
        return res.redirect("/cart");
      }
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("appliedCoupon");

    if (!cart || cart.items.length === 0) {
      req.session.couponMessage = "Your cart is empty";
      return res.redirect("/cart");
    }

    if (cart.appliedCoupon && cart.appliedCoupon._id.equals(coupon._id)) {
      req.session.couponMessage = "This coupon is already applied";
      return res.redirect("/cart");
    }

    const subtotal = cart.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = subtotal * (coupon.discountValue / 100);
      discountAmount = Math.min(discountAmount, subtotal);
    } else {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    }

    cart.appliedCoupon = coupon._id;
    cart.discountAmount = discountAmount;
    await cart.save();

    req.session.couponMessage = `Coupon "${coupon.code}" applied successfully!`;
    res.redirect("/cart");
  } catch (error) {
    console.error("Coupon application error:", error);
    req.session.couponMessage = "Failed to apply coupon";
    res.redirect("/cart");
  }
});

// Remove coupon
router.get("/remove-coupon", async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;
    if (!userId) {
      req.session.couponMessage = "Not authorized";
      return res.redirect("/auth/login");
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      req.session.couponMessage = "Cart not found";
      return res.redirect("/cart");
    }

    if (!cart.appliedCoupon) {
      req.session.couponMessage = "No coupon applied to remove";
      return res.redirect("/cart");
    }

    cart.appliedCoupon = undefined;
    cart.discountAmount = 0;
    await cart.save();

    req.session.couponMessage = "Coupon removed successfully";
    res.redirect("/cart");
  } catch (error) {
    console.error("Error removing coupon:", error);
    req.session.couponMessage = "Failed to remove coupon";
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

// Remove item
router.post("/remove-item", async (req, res) => {
  try {
    const { productId, size } = req.body;
    let userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
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
