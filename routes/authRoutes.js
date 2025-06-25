const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
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

// Generate OTP
function generateOTP() {
  return randomstring.generate({ length: 4, charset: "numeric" });
}

// Send OTP
function sendOTP(email, otp) {
  const mailOPTION = {
    from: "asusualclothing@gmail.com",
    to: email,
    subject: "OTP verification",
    text: `your otp is :${otp}`,
  };

  let transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  transporter.sendMail(mailOPTION, (error, info) => {
    if (error) {
      console.log("error ", error);
    } else {
      console.log("OTP Email sent successfully:", info.response);
    }
  });
}

const otpCache = {};

// Signup page
router.get("/signup", (req, res) => {
  res.render("signup2");
});

// Generate OTP
router.post("/generate-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send({
        success: false,
        message: "Email already exists. Please check the database.",
      });
    }

    const otp = generateOTP();
    otpCache[email] = otp;
    sendOTP(email, otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error checking user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (otpCache[email] === otp) {
    res.json({ success: true, message: "OTP verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// User signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, otp } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).send("Password and Confirm Password do not match");
    }


    // Hash the password before saving it to the database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user in the database
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    // console.log(user);
    res.redirect("/");
  } catch (error) {
    console.error("Error signing up user:", error);
    res.status(500).send("Error signing up user: " + error.message);
  }
});

// User login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      req.session.loginError = "Please provide both email and password";
      return res.redirect("/signup");
    }

    const user = await User.findOne({ email });

    if (!user) {
      req.session.loginError = "Invalid email or password";
      return res.send(`
                <script>
                  alert('wrong email or password');
                  window.location.href = '/signup';
                </script>
            `);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      req.session.loginError = "Invalid email or password";
      return res.send(`
                <script>
                  alert('wrong email or password');
                  window.location.href = '/signup';
                </script>
            `);
    }

    // Create JWT token
    const SECRET_KEY = process.env.JWT_SECRET || "Preaveen@8233";
    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "1h",
    });

    // Set session and cookies
    req.session.userId = user._id.toString();
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 3600000, // 1 hour
      secure: process.env.NODE_ENV === "production",
    });

    // Successful login redirect
    return res.redirect("/");
  } catch (error) {
    console.error("Error logging in user:", error);
    req.session.loginError = "Error logging in. Please try again.";
    res.redirect("/signup");
  }
});


// Logout
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out, please try again");
    }
    res.clearCookie("connect.sid");
    res.clearCookie("userId");
    res.redirect("/");
  });
});

// Reset password
router.get("/reset-password", (req, res) => {
  res.render("forget_password", { message: null });
});

router.get("/reset-password/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(400).send("Invalid or expired reset token");

    res.render("reset_password", {
      userId: user._id,
      token: user.resetToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

router.post("/reset-password-submit", async (req, res) => {
  const { userId, token, password } = req.body;
  try {
    const user = await User.findOne({
      _id: userId,
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() },
    });

    if (!user) return res.status(400).send("Invalid or expired reset token");

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();

    return res.send(`
      <script>
        alert('Password has been reset successfully');
        window.location.href = '/auth/signup';
      </script>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong. Try again later.");
  }
});

router.post("/reset-password", async (req, res) => {
  const { email } = req.body;
  if (!email || email.trim() === "") {
    return res.render("forget_password", {
      message: "Please enter your email address.",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.render("forget_password", { message: "Email not registered" });

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiration = Date.now() + 15 * 60 * 1000;

    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    const resetLink = `${process.env.BASE_URL || "http://localhost:8000"}/auth/reset-password/${user._id}`;

    const mailOptions = {
      from: "asusualclothing@gmail.com",
      to: email,
      subject: "Assusal Password Reset",
      html: `
        <h2>Hello ${user.name},</h2>
        <p>Click below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    };

    let transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error:", error);
        return res.render("forget_password", {
          message: "Failed to send email. Try again later.",
        });
      } else {
        console.log("Reset Password Email sent:", info.response);
        return res.send(`
          <script>
            alert('Reset link has been sent to your email');
            window.location.href = '/auth/reset-password';
          </script>
        `);
      }
    });
  } catch (err) {
    console.error(err);
    return res.render("forget_password", {
      message: "Something went wrong. Try again later.",
    });
  }
});




module.exports = router;