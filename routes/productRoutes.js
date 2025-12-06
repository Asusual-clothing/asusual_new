const express = require("express");
const mongoose = require("mongoose");
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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
// Middleware

// Use memory storage (recommended for Cloudinary)
// Configure multer with increased file size limit
const uploads = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  }
});

// Cloudinary configuration with chunked upload for large files
const cloudinaryUploadOptions = {
  resource_type: 'auto',
  quality_analysis: false,
  quality: '100',
  fetch_format: 'auto',
  chunk_size: 50 * 1024 * 1024, // 50MB chunks
  transformation: [
    { quality: 'auto:best' },
  ],
};

const uploadImage = async (file, oldUrl = null) => {
  if (oldUrl) {
    const publicId = extractPublicIdFromUrl(oldUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  }
  const result = await cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    {
      quality: "auto:best",
      fetch_format: "auto",
      width: 800,
      height: 1000,
      crop: "fill",
      gravity: "auto:faces",
    }
  );
  return result.secure_url;
};

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


// Helper function
function extractPublicIdFromUrl(url) {
  try {
    const splitUrl = url.split("/upload/");
    if (splitUrl.length < 2) return null;

    const pathParts = splitUrl[1].split("/");

    if (pathParts[0].startsWith("v")) {
      pathParts.shift();
    }

    const fileNameWithExt = pathParts.pop();
    const fileName = fileNameWithExt.split(".")[0];
    const folder = pathParts.join("/");

    return `${folder}/${fileName}`;
  } catch (err) {
    console.error("Failed to extract public_id from Cloudinary URL:", url);
    return null;
  }
}

// Add product form
router.get("/add-product", checkAdminAuth, (req, res) => {
  res.render("Admin/add_product", {
    activePage: "add-product", // ✅ pass this to highlight the correct link
    title: "Add Product",      // optional page title
  });
});

router.post("/add-product", uploads.any(), async (req, res) => {
  try {
    const { name, description, MRP, price, brand, bestseller, categoryType, star, washing, award, insideout } = req.body;
    let { color, colorCode } = req.body;

    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

    // Basic validation
    if (!name || !description || !price || !MRP || !categoryType) {
      const msg = "Missing required fields or category type";
      return isAjax
        ? res.status(400).json({ success: false, message: msg })
        : (req.flash("error_msg", msg), res.redirect("/products/add-product"));
    }

    // LOG incoming body/files for debugging
    console.log(">>> REQ.BODY COLORS:", req.body.color);
    console.log(">>> REQ.BODY COLORCODES:", req.body.colorCode);
    console.log(">>> REQ.FILES fieldnames:", req.files.map(f => f.fieldname));

    // Handle color inputs
    if (!color) color = [];
    if (!Array.isArray(color)) color = [color];
    color = color.map(c => (typeof c === "string" ? c.trim().toLowerCase() : "")).filter(c => c !== "");

    if (!colorCode) colorCode = [];
    if (!Array.isArray(colorCode)) colorCode = [colorCode];

    // Upload helper (same as yours)
    const uploadToCloudinary = async (file) => {
      if (!file) return null;
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        const readableStream = new Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      }).then(r => r.secure_url);
    };

    // Required product images (same)
    const frontImageFile = req.files.find(f => f.fieldname === "front_images");
    const backImageFile = req.files.find(f => f.fieldname === "back_image");

    if (!frontImageFile || !backImageFile) {
      const msg = "Front and back product images are required";
      return isAjax
        ? res.status(400).json({ success: false, message: msg })
        : (req.flash("error_msg", msg), res.redirect("/products/add-product"));
    }

    const front_image = await uploadToCloudinary(frontImageFile);
    const back_image = await uploadToCloudinary(backImageFile);

    // General images
    const generalImages = req.files.filter(f => f.fieldname === "images");
    const images = await Promise.all(generalImages.map(f => uploadToCloudinary(f)));

    // Color-wise images
    const colorImages = [];

    for (let i = 0; i < color.length; i++) {
      // try both naming patterns (be forgiving)
      const frontFiles = req.files.filter(f =>
        f.fieldname === `colorFrontImages${i}[]` || f.fieldname === `colorFrontImages${i}`
      );

      const backFiles = req.files.filter(f =>
        f.fieldname === `colorBackImages${i}[]` || f.fieldname === `colorBackImages${i}` ||
        f.fieldname === `backColorImage${i}` || f.fieldname === `backColorImage${i}[]`
      );

      const extraFiles = req.files.filter(f =>
        f.fieldname === `colorImages${i}[]` || f.fieldname === `colorImages${i}`
      );

      const frontImg = frontFiles.length ? await uploadToCloudinary(frontFiles[0]) : null;
      const backImg = backFiles.length ? await uploadToCloudinary(backFiles[0]) : null;
      const extraImages = extraFiles.length ? await Promise.all(extraFiles.map(f => uploadToCloudinary(f))) : [];

      // If you require front/back for each color, enforce here:
      // if (!frontImg || !backImg) { /* return error or handle accordingly */ }

      colorImages.push({
        color: color[i],
        colorCode: colorCode[i] || "#000000",
        frontImage: frontImg || "",
        backImage: backImg || "",
        images: extraImages
      });
    }

    // Sizes
    const sizes = {
      xsmall: parseInt(req.body.sizes?.xsmall) || 0,
      small: parseInt(req.body.sizes?.small) || 0,
      medium: parseInt(req.body.sizes?.medium) || 0,
      large: parseInt(req.body.sizes?.large) || 0,
      xlarge: parseInt(req.body.sizes?.xlarge) || 0,
      xxlarge: parseInt(req.body.sizes?.xxlarge) || 0,
    };

    // Save product (note: if schema requires non-empty strings, pass "" instead of null)
    const product = new Product({
      name,
      description,
      MRP,
      price,
      brand,
      color,
      categoryType,
      sizes,
      bestseller: bestseller === "true" || bestseller === "on",
      front_image,
      back_image,
      images,
      colorImages,
      star,
      washing,
      award,
      insideout
    });

    await product.save();

    if (isAjax) return res.json({ success: true, message: "Product added successfully", product });

    req.flash("success_msg", "Product added successfully!");
    return res.redirect("/products/add-product");

  } catch (error) {
    console.error("Error adding product:", error);
    const msg = `Failed to add product: ${error.message}`;

    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
    return isAjax
      ? res.status(500).json({ success: false, message: msg })
      : (req.flash("error_msg", msg), res.redirect("/products/add-product"));
  }
});





router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: "desc" })
      .populate("categoryType", "name")
      .lean();

    const notification = (await Notification.findOne({})) || { notification: "" };

    const availableColors = [
      ...new Set(
        products
          .flatMap((p) =>
            Array.isArray(p.color)
              ? p.color.map((c) => c.toLowerCase())
              : typeof p.color === "string"
                ? [p.color.toLowerCase()]
                : []
          )
      ),
    ];

    const categoryTypes = [
      ...new Set(products.map((p) => p.categoryType?.name).filter(Boolean)),
    ];

    const userId = req.session.userId || req.cookies.userId;
    let user = null;
    let cartCount = 0;
    if (userId) {
      user = await User.findById(userId, "name _id email");
      const cart = await Cart.findOne({ user: userId });
      if (cart && Array.isArray(cart.items)) {
        // Total quantity of all items in the cart
        cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
      }
    }
    res.render("User/allProduct", {
      notification,
      products: products.map((p) => ({
        ...p,
        id: p._id.toString(),
      })),
      availableColors,
      categoryTypes, // 🟢 pass to frontend
      user,
      cartCount,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Error fetching products");
  }
});

router.get("/edit-product", checkAdminAuth, async (req, res) => {
  try {
    const products = await Product.find(
      {},
      "name MRP price front_image  brand bestseller sizes description color categoryType colorImages award insideout washing star"
    )
      .populate("categoryType", "name _id")
      .lean();

    const updatedProducts = products.map(product => ({
      ...product,
      front_image: product.front_image || null,
    }));

    res.render("Admin/edit_product", {
      products: updatedProducts,
      activePage: "edit-product",
      title: "Edit Product",
    });

  } catch (error) {
    console.error("Error loading edit products:", error);

    req.flash("error_msg", "Failed to load products: " + error.message);
    res.redirect("/admin/dashboard");
  }
});


router.post("/edit-product/:id", checkAdminAuth, uploads.any(), async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error_msg", "Invalid product ID");
      return res.redirect("/products/edit-product");
    }

    const product = await Product.findById(id);
    if (!product) {
      req.flash("error_msg", "Product not found");
      return res.redirect("/products/edit-product");
    }

    // Parse colors
    let colorArray = req.body.color ? JSON.parse(req.body.color) : [];
    colorArray = colorArray.map((c) => c.trim().toLowerCase()).filter(c => c);

    let deletedArray = req.body.deletedColors ? JSON.parse(req.body.deletedColors) : [];
    deletedArray = deletedArray.map((c) => c.trim().toLowerCase());

    const sizes = req.body.sizes || {};

    const updateData = {
      name: req.body.name,
      description: req.body.description,
      MRP: req.body.MRP,
      price: req.body.price,
      brand: req.body.brand || "AsUsual",
      categoryType: req.body.categoryType || product.categoryType,
      bestseller: req.body.bestseller === "true",
      color: colorArray,
      sizes: {
        xsmall: Number(sizes.xsmall) || 0,
        small: Number(sizes.small) || 0,
        medium: Number(sizes.medium) || 0,
        large: Number(sizes.large) || 0,
        xlarge: Number(sizes.xlarge) || 0,
        xxlarge: Number(sizes.xxlarge) || 0,
      },
      award: req.body.award,
      insideout: req.body.insideout,
      washing: req.body.washing,
      star: req.body.star,
    };

    const getFilesBy = (field) => req.files.filter(f => f.fieldname === field);

    // FRONT IMAGE
    const frontFiles = getFilesBy("front_image");
    updateData.front_image = frontFiles.length
      ? await uploadImage(frontFiles[0], product.front_image)
      : product.front_image;

    // BACK IMAGE
    const backFiles = getFilesBy("back_image");
    updateData.back_image = backFiles.length
      ? await uploadImage(backFiles[0], product.back_image)
      : product.back_image;

    // GENERAL IMAGES
    const galleryFiles = getFilesBy("images");
    if (galleryFiles.length) {
      // delete old
      for (const img of product.images) {
        const id = extractPublicIdFromUrl(img);
        await cloudinary.uploader.destroy(id);
      }
      updateData.images = await Promise.all(galleryFiles.map((f) => uploadImage(f)));
    } else {
      updateData.images = product.images;
    }

    // --------------------------
    // COLOR IMAGE HANDLING START
    // --------------------------

    const newColorImages = {};

    // keep existing colors (excluding deleted)
    for (const entry of product.colorImages) {
      if (deletedArray.includes(entry.color)) {
        // delete all cloud images for this color
        for (const img of entry.images) {
          const id = extractPublicIdFromUrl(img);
          if (id) await cloudinary.uploader.destroy(id);
        }
        if (entry.frontImage) {
          const id = extractPublicIdFromUrl(entry.frontImage);
          if (id) await cloudinary.uploader.destroy(id);
        }
        if (entry.backImage) {
          const id = extractPublicIdFromUrl(entry.backImage);
          if (id) await cloudinary.uploader.destroy(id);
        }
        continue;
      }
      newColorImages[entry.color] = {
        images: entry.images,
        frontImage: entry.frontImage || null,
        backImage: entry.backImage || null,
        colorCode: entry.colorCode,
      };
    }

    // handle updated/new colors
    for (const color of colorArray) {
      const gallery = getFilesBy(`colorImages_${color}`);
      const front = getFilesBy(`colorFront_${color}`);
      const back = getFilesBy(`colorBack_${color}`);

      const old = newColorImages[color] || { images: [], frontImage: null, backImage: null };

      // Upload gallery images OR keep old
      const galleryUploaded = gallery.length
        ? await Promise.all(gallery.map(f => uploadImage(f)))
        : old.images;

      const frontUploaded = front.length
        ? await uploadImage(front[0], old.frontImage)
        : old.frontImage;

      const backUploaded = back.length
        ? await uploadImage(back[0], old.backImage)
        : old.backImage;

      newColorImages[color] = {
        images: galleryUploaded,
        frontImage: frontUploaded,
        backImage: backUploaded,
        colorCode: req.body[`colorCode_${color}`] || old.colorCode || "#000000",
      };
    }

    // convert final map → array
    updateData.colorImages = Object.entries(newColorImages).map(([color, data]) => ({
      color,
      images: data.images,
      frontImage: data.frontImage,
      backImage: data.backImage,
      colorCode: data.colorCode,
    }));

    // -------------------------
    // COLOR IMAGE HANDLING END
    // -------------------------

    await Product.findByIdAndUpdate(id, updateData, { new: true });

    req.flash("success_msg", "Product updated successfully!");
    res.redirect("/products/edit-product");

  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Update failed: " + err.message);
    res.redirect("/products/edit-product/" + id);
  }
});



// Product details


router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const selectedColor = req.query.color;   // ✅ GET color from URL

    const product = await Product.findById(productId);
    if (!product) return res.status(404).send("Product not found");

    const userId = req.session.userId || req.cookies.userId;
    let user = { name: "Guest" };
    let cartCount = 0;

    if (userId) {
      user = await User.findById(userId, "name _id");
      const cart = await Cart.findOne({ user: userId });
      if (cart) {
        cartCount = cart.items.reduce((t, i) => t + i.quantity, 0);
      }
    }

    res.render("User/product_detail", {
      product,
      user,
      productId: product._id,
      cartCount,
      selectedColor  // ✅ Pass to EJS
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});


// Delete product
router.post("/delete/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");

    const idsToDelete = [
      extractPublicIdFromUrl(product.front_image),
      extractPublicIdFromUrl(product.back_image),
      ...product.images.map((img) => extractPublicIdFromUrl(img)),
    ];

    console.log("Attempting to delete the following Cloudinary public_ids:", idsToDelete);

    for (const id of idsToDelete) {
      if (id) {
        const result = await cloudinary.uploader.destroy(id);
        console.log(`Deleted ${id}:`, result);
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/products/edit-product");
  } catch (err) {
    console.error("Deletion error:", err);
    res.status(500).send("Error deleting product and images");
  }
});



module.exports = router;