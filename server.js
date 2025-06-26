  const express = require("express");
  const mongoose = require("mongoose");
  const bodyParser = require("body-parser");
  const multer = require("multer");
  const path = require("path");
  const bcrypt = require("bcrypt");
  const jwt = require("jsonwebtoken");
  const cookieParser = require("cookie-parser");
  const randomstring = require("randomstring");
  const cloudinary = require("cloudinary").v2;
  const nodemailer = require("nodemailer");
  const session = require("express-session");
  const flash = require("connect-flash");
  const dotenv = require("dotenv");
  const crypto = require("crypto");
  const MongoStore = require("connect-mongo");
  const { uploads } = require("./config/cloudinary");
  const methodOverride = require("method-override");

  require("dotenv").config();

  // Initialize Express app
  const app = express();
  const PORT = process.env.PORT || 8000;

  // Connect to MongoDB Atlas
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch((err) => console.error("MongoDB connection error:", err));

  const Cashfree = require("cashfree-pg");
  Cashfree.XClientId = process.env.CASHFREE_APP_ID;
  Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
  Cashfree.XEnvironment = process.env.CASHFREE_MODE === 'PROD' ? 'PRODUCTION' : 'SANDBOX';

  // Middleware
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(express.static(path.join(__dirname, "public")));
  app.use(cookieParser());
  app.use(methodOverride("_method"));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "Preaveen@8233",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
      cookie: { secure: false, maxAge: 3600000 },
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(flash());

  // Make flash messages available to all views
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
  });


  const attachUser = async (req, res, next) => {
  try {
    const userId = req.session.userId || req.cookies.userId;
    req.user = userId
      ? await User.findById(userId, "name email phone createdAt")
      : null;
    res.locals.user = req.user; // This makes user available in all views
    next();
  } catch (error) {
    console.error("User attachment error:", error);
    next(error);
  }
};

app.use(attachUser);
app.use(async (req, res, next) => {
  try {
    if (req.user) {
      const cart = await Cart.findOne({ user: req.user._id });
      let totalCount = 0;

      if (cart && cart.items && cart.items.length > 0) {
        totalCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      }

      res.locals.cartCount = totalCount;
    } else {
      res.locals.cartCount = 0;
    }
  } catch (err) {
    console.error("Error fetching cart count:", err);
    res.locals.cartCount = 0;
  }

  next();
});


  // Set EJS as the view engine
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // Import database models
  const Product = require("./models/Product");
  const User = require("./models/UserSchema");
  const Cart = require("./models/CartSchema");
  const Admin = require("./models/AdminSchema");
  const CustomTshirt = require("./models/CustomTshirtSchema");
  const Poster = require("./models/posterSchema");
  const Order = require("./models/OrderSchema");
  const Contact = require("./models/Contact");
  const Notification = require("./models/Notification");
  const Subscription = require("./models/subscription");
  const Testimonial = require("./models/Testimonial");
  const DeliveryCost = require("./models/Deliveryschema");
  const Coupon = require("./models/CouponSchema");

  // Import routes
  const adminRoutes = require("./routes/adminRoutes");
  const authRoutes = require("./routes/authRoutes");
  const cartRoutes = require("./routes/cartRoutes");
  const couponRoutes = require("./routes/couponRoutes");
  const orderRoutes = require("./routes/orderRoutes");
  const paymentRoutes = require("./routes/paymentRoutes");
  const productRoutes = require("./routes/productRoutes");
  const userRoutes = require("./routes/userRoutes");
  const posterRoutes = require("./routes/posterRoutes");
  // const product_detail = require("./routes/product_detail")

  // Use routes
  app.use("/admin", adminRoutes);
  app.use("/auth", authRoutes);
  app.use("/cart", cartRoutes);
  app.use("/coupons", couponRoutes);
  app.use("/orders", orderRoutes);
  app.use("/payment", paymentRoutes);
  app.use("/products", productRoutes);
  app.use("/user", userRoutes);
  app.use("/posters", posterRoutes);
  // app.use("/product_details", product_detail)
  function generateOTP() {
    return randomstring.generate({ length: 4, charset: "numeric" });
  }
  const otpCache = {}; 

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

  // Home route
  app.get("/", async (req, res) => {
    try {
      const Products = await Product.find();

      // Shuffle function
      function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }

      const shuffledProducts = shuffle([...Products]);
      const testimonials = await Testimonial.find({});
      const notification = (await Notification.findOne({})) || {
        notification: "",
      };
      const poster = await Poster.findOne({});
      const posters = poster ? poster.image : [];
      const headings = poster ? poster.Heading : [];
      const titles = poster ? poster.Title : [];

      // Get user information if logged in
      const userId = req.session.userId || req.cookies.userId;
      let user = null;
      let cartCount = 0;

      if (userId) {
        user = await User.findById(userId, "name _id email phone createdAt");
        
        // Fetch cart count if user is logged in
        const cart = await Cart.findOne({ userId });
        if (cart) {
          cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
        }
      }

      res.render("index", {
        
        Products: shuffledProducts,
        posters,
        headings,
        testimonials,
        titles,
        notification,
        message: null,
        user, // Pass user to the template
        cartCount // Pass cartCount to the template
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });



  //$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$OTP RoUTES$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
  //$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$OTP RoUTES$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
  app.post("/generate-otp", async (req, res) => {
    const { email } = req.body;

    try {
      // Check if user already exists in the database
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.send({
          success: false,
          message: "Email already exists. Please check the database.",
        });
      }

      const otp = generateOTP();
      otpCache[email] = otp; // Store OTP in cache
      sendOTP(email, otp);

      res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error checking user:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Route to verify OTP
  app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (otpCache[email] === otp) {
      res.json({ success: true, message: "OTP verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  });

  app.get("/signup", (req, res) => {
    res.render("signup2");
  });

  // Simple routes
  app.get("/about", (req, res) => {
    res.render("aboutUs");
  });

  app.get("/Terms-and-conditions", (req, res) => {
    res.render("termsandcondition");
  });

  app.get("/privacy_policy", (req, res) => {
    res.render("privacypolicy");
  });

  app.get("/contact", (req, res) => {
    res.render("contactUs");
  });

  app.get("/Shipping-policy", (req,res)=>{
    res.render("shipping_policy");
  })
  
  app.get("/Refund-policy", (req,res)=>{
    res.render("refund_policy");
  })

  app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Could not log out, please try again");
      }
      res.clearCookie("connect.sid"); // Clear the session cookie
      res.clearCookie("userId"); // Clear the user ID cookie
      res.redirect("/");
    });
  });

  // Start the server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });