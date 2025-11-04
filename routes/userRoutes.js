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

// Contact form
// Contact form
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      req.flash("error_msg", "All fields are required.");
      return res.redirect("/"); // redirect back to home or contact page
    }

    const contact = new Contact({ name, email, message });
    await contact.save();

    req.flash(
      "success_msg",
      "Thank you for reaching out! We will get back to you shortly."
    );
    return res.redirect("/contact");
  } catch (error) {
    console.error("Error saving contact info:", error);
    req.flash("error_msg", "An error occurred while submitting your message.");
    return res.redirect("/contact");
  }
});

// Subscribe
router.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  try {
    const newSub = new Subscription({ email });
    await newSub.save();
    console.log("chala")
    req.flash("success_msg", "Subscription successful!");
    return res.redirect("/");
  } catch (err) {
    console.error(err);
    let message = "Something went wrong. Please try again.";
    if (err.code === 11000) message = "You are already subscribed.";
    if (err.errors && err.errors.email) message = err.errors.email.message;

    req.flash("error_msg", message);
    return res.redirect("/");
  }
});

// Custom tshirt
router.post("/custom-tshirt", async (req, res) => {
  const { frontDesign, backDesign } = req.body;
  try {
    const design = new CustomTshirt({
      frontImage: frontDesign,
      backImage: backDesign,
    });
    await design.save();
    res.status(200).send("Design saved successfully");
  } catch (error) {
    console.error("Error saving design:", error);
    res.status(500).send("Error saving design");
  }
});

module.exports = router;