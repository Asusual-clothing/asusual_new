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
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).send("All fields are required.");
    }

    const contact = new Contact({ name, email, message });
    await contact.save();

    res.send(`
      <script>
        alert('Thank you for your approach, we will get back to you shortly');
        window.location.href = '/';
      </script>
    `);
  } catch (error) {
    console.error("Error saving contact info:", error);
    res.status(500).send("An error occurred while submitting your message.");
  }
});

// Subscribe
router.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  try {
    const newSub = new Subscription({ email });
    await newSub.save();
    return res.send(`
      <script>
        alert('Subscription successful!');
        window.location.href = '/';
      </script>
    `);
  } catch (err) {
    console.error(err);
    let message = "Something went wrong. Please try again.";
    if (err.code === 11000) message = "You are already subscribed.";
    if (err.errors && err.errors.email) message = err.errors.email.message;

    return res.send(`
      <script>
        alert('${message}');
        window.location.href = '/';
      </script>
    `);
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