const express = require("express");
const router = express.Router();

const { uploads } = require("../config/cloudinary");
const bcrypt = require("bcrypt");
const checkAdminAuth = require("../middleware/checkAdminAuth");
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
const Category = require("../models/Category")


// Admin Login Page
router.get("/login", (req, res) => {
  res.render("Admin/admin_login");
});

// Admin Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.status(400).send("Password and Confirm Password do not match");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashedPassword });
    res.redirect("/admin/login");
  } catch (error) {
    console.error("Error signing up admin:", error);
    res.status(500).send("Error signing up admin");
  }
});

// Admin Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    req.session.adminId = admin._id;
    res.cookie("adminId", admin._id, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin Logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.flash("error_msg", "Failed to log out");
      return res.redirect("/admin/dashboard"); // redirect back to dashboard on failure
    }
    res.clearCookie("adminId");
    req.flash("success_msg", "You have been logged out successfully!");
    res.redirect("/admin/login");
  });
});

// Admin Dashboard
router.get("/dashboard", checkAdminAuth, async (req, res) => {
  try {
    const [totalProducts, totalOrders, activeCoupons] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Coupon.countDocuments({ active: true }),
    ]);
    res.render("Admin/admin_option", {
      counts: { totalProducts, totalOrders, activeCoupons },
      activePage: "add-product", // ✅ define separately
    });
    
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).send("Server Error");
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    req.flash("success", "Contact request deleted successfully");
    res.redirect("/admin/contacts");
  } catch (err) {
    console.error("Error deleting contact:", err);
    req.flash("error", "Failed to delete contact request");
    res.redirect("/admin/contacts");
  }
});


// ========================= CONTACT REQUESTS =========================
router.get("/contacts", checkAdminAuth, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ submittedAt: -1 });
    res.render("Admin/contact_request", {
      contacts,
      activePage: "contacts", // ✅
      title: "Contact Requests",
    });
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).send("Internal Server Error");
  }
});


// ========================= TESTIMONIALS =========================
router.get("/testimonials/:id?", checkAdminAuth, async (req, res) => {
  try {
    const testimonials = await Testimonial.find();
    const testimonial = req.params.id
      ? await Testimonial.findById(req.params.id)
      : null;

    res.render("Admin/testimonials", {
      testimonials,
      testimonial,
      activePage: "testimonials", // ✅
      title: "Manage Testimonials",
    });
  } catch (err) {
    console.error("Error fetching testimonials:", err);
    res.status(500).send("Internal Server Error");
  }
});



router.post("/testimonials", uploads.single("image"), async (req, res) => {
  try {
    let imageUrl = "";
    if (req.file) {
      imageUrl = req.file.path; // This is the Cloudinary URL
    }

    const testimonial = new Testimonial({
      name: req.body.name,
      role: req.body.role,
      imageUrl: imageUrl,
      quote: req.body.quote,
    });

    await testimonial.save();
    res.redirect("/admin/testimonials");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error uploading image or saving testimonial");
  }
});

// POST route to handle editing a testimonial
router.post(
  "/testimonials/:id",
  uploads.single("image"),
  async (req, res) => {
    try {
      const testimonial = await Testimonial.findById(req.params.id);
      if (!testimonial) return res.status(404).send("Testimonial not found");

      // Use new image if uploaded, else keep old
      const imageUrl = req.file ? req.file.path : testimonial.imageUrl;

      testimonial.name = req.body.name;
      testimonial.role = req.body.role;
      testimonial.imageUrl = imageUrl;
      testimonial.quote = req.body.quote;

      await testimonial.save();
      res.redirect("/admin/testimonials");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating testimonial");
    }
  }
);

// Handle add/update

// Handle delete
router.post("/testimonials/:id/delete", async (req, res) => {
  await Testimonial.findByIdAndDelete(req.params.id);
  res.redirect("/admin/testimonials");
});


router.get("/delivery-cost", checkAdminAuth, async (req, res) => {
  try {
    let delivery = await DeliveryCost.findOne();
    const categories = await Category.find().sort({ name: 1 });

    if (!delivery) {
      delivery = new DeliveryCost({ cost: 0 });
      await delivery.save();
    }

    res.render("Admin/deliverycharge", {
      delivery,
      categories,
      activePage: "delivery-cost", // ✅ added this line
      title: "Delivery Charge",    // optional, for page title
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// Update delivery cost
router.post("/delivery-cost", async (req, res) => {
  try {
    let delivery = await DeliveryCost.findOne();
    if (!delivery) {
      delivery = new DeliveryCost({ cost: req.body.cost });
    } else {
      delivery.cost = req.body.cost;
      delivery.updatedAt = Date.now();
    }
    await delivery.save();
    res.redirect("/admin/delivery-cost");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});




module.exports = router;