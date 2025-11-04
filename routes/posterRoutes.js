
// Add this at the top of your router configuration
const express = require("express");
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
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



const checkAdminAuth = async (req, res, next) => {
  try {
    const adminId = req.session.adminId || req.cookies.adminId;
    if (!adminId) {
      return res.redirect("/admin/login");
    }
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

const uploads = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Limit to 1 file per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

const cloudinary = require('cloudinary').v2;

// Cloudinary upload options (disable quality degradation)
const cloudinaryUploadOptions = {
  resource_type: 'image',
  quality_analysis: false, // Disable automatic quality adjustment
  quality: '100', // Maximum quality (100%)
  fetch_format: 'auto', // Let Cloudinary decide format (but keep quality high)
  transformation: [
    { quality: 'auto:best' }, // Prioritize best quality
  ],
};

// For Notification Update (remains the same)
router.post("/update-notification", async (req, res) => {
  try {
    const { notification } = req.body;

    await Notification.findOneAndUpdate(
      {},
      { notification },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.redirect("/posters/edit-poster");
  } catch (error) {
    console.error("Notification Update Error:", error);
    res.status(500).send("Failed to update notification");
  }
});

// ========================= EDIT POSTER =========================
router.get("/edit-poster", checkAdminAuth, async (req, res) => {
  try {
    const poster = (await Poster.findOne({})) || {
      image: ["", "", ""],
      Heading: ["", "", ""],
      Title: ["", "", ""],
    };
    const notification = (await Notification.findOne({})) || {
      notification: "",
    };

    res.render("Admin/edit_poster", {
      poster,
      notification,
      activePage: "edit-poster", // ✅ sidebar highlight
      title: "Edit Poster",      // optional
    });
  } catch (error) {
    console.error("Error loading edit-poster:", error);
    res.status(500).send("Server Error");
  }
});


router.post(
  "/edit-poster/:index",
  checkAdminAuth,
  (req, res, next) => {
    uploads.single("posterImage")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        if (err.code === "LIMIT_FILE_SIZE") {
          req.flash("error_msg", "File size too large. Maximum allowed is 50MB");
          return res.redirect("/posters/edit-poster");
        }
        req.flash("error_msg", `File upload error: ${err.message}`);
        return res.redirect("/posters/edit-poster");
      } else if (err) {
        // An unknown error occurred
        req.flash("error_msg", `Error: ${err.message}`);
        return res.redirect("/posters/edit-poster");
      }
      // Everything went fine
      next();
    });
  },
  async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index) || index < 0 || index > 2) {
        req.flash("error_msg", "Invalid poster index");
        return res.redirect("/posters/edit-poster");
      }

      const { Heading, Title } = req.body;
      const file = req.file;

      let poster = (await Poster.findOne({})) || {
        image: ["", "", ""],
        Heading: ["", "", ""],
        Title: ["", "", ""],
      };

      const update = {
        image: [...poster.image],
        Heading: [...poster.Heading],
        Title: [...poster.Title],
      };

      if (file) {
        try {
          // Compress image before uploading
          const compressedBuffer = await sharp(file.buffer)
            .resize(1920, 1080, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();

          const dataUri = `data:${file.mimetype};base64,${compressedBuffer.toString(
            "base64"
          )}`;

          const result = await cloudinary.uploader.upload(dataUri, {
            resource_type: "auto",
            quality: "auto:good",
          });

          update.image[index] = result.secure_url;
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          req.flash(
            "error_msg",
            "Failed to upload image. Please try a smaller file or different image."
          );
          return res.redirect("/posters/edit-poster");
        }
      }

      if (Heading !== undefined) update.Heading[index] = Heading;
      if (Title !== undefined) update.Title[index] = Title;

      await Poster.findOneAndUpdate({}, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      req.flash("success_msg", "Poster updated successfully");
      return res.redirect("/posters/edit-poster");
    } catch (error) {
      console.error("Error updating poster:", error);
      req.flash("error_msg", `Error updating poster: ${error.message}`);
      return res.redirect("/posters/edit-poster");
    }
  }
);


// Remove the duplicate /edit-poster route (the one with uploads.fields())

module.exports = router;