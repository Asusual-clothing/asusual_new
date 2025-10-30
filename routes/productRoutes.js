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
const Category= require("../models/Category")
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



router.post(
  "/add-product",
  uploads.any(), // Accept all dynamic fields
  async (req, res) => {
    try {
      const { name, description, MRP, price, brand, bestseller, category, categoryType } = req.body;
      let { color } = req.body;

      if (!name || !description || !price || !MRP || !category) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }
      if (!categoryType) {
        return res.status(400).json({
          success: false,
          message: "Category type is required",
        });
      }
      if (!req.files) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
      }

      // Ensure color array
      if (!color) color = [];
      if (!Array.isArray(color)) color = [color];
      color = color.filter((c) => c && c.trim() !== "");

      // Upload helper
      const uploadToCloudinary = async (file) => {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          const readableStream = new Readable();
          readableStream.push(file.buffer);
          readableStream.push(null);
          readableStream.pipe(uploadStream);
        });
        return result.secure_url;
      };

      // Upload main images
      const frontImageFile = req.files.find((f) => f.fieldname === "front_images");
      const backImageFile = req.files.find((f) => f.fieldname === "back_image");
      if (!frontImageFile || !backImageFile)
        return res.status(400).json({ success: false, message: "Front and back images required" });

      const front_image = await uploadToCloudinary(frontImageFile);
      const back_image = await uploadToCloudinary(backImageFile);

      // Upload additional general images
      const generalImages = req.files.filter((f) => f.fieldname === "images");
      const images = await Promise.all(
        generalImages.map((file) => uploadToCloudinary(file))
      );

      // Upload color-specific images
      const colorImages = [];
      for (let i = 0; i < color.length; i++) {
        const fieldname = `colorImages${i}[]`;
        const files = req.files.filter((f) => f.fieldname === fieldname);

        const urls = await Promise.all(
          files.map((file) => uploadToCloudinary(file))
        );

        colorImages.push({
          color: color[i],
          images: urls,
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

      // Create product
      const product = new Product({
        name,
        description,
        MRP,
        price,
        brand,
        color, // Array of color names
        colorImages, // Array of { color, images }
        category,
        categoryType,
        sizes,
        bestseller: bestseller === "true" || bestseller === "on",
        front_image,
        back_image,
        images,
      });

      await product.save();

      res.json({
        success: true,
        message: "Product added successfully",
        product,
      });
    } catch (error) {
      console.error("Error adding product:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add product",
        error: error.message,
      });
    }
  }
);




router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: "desc" })
      .populate("categoryType", "name") // 🟢 populate category type name
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

    // 🟢 Get distinct category types for filter list
    const categoryTypes = [
      ...new Set(products.map((p) => p.categoryType?.name).filter(Boolean)),
    ];

    const userId = req.session.userId || req.cookies.userId;
    let user = null;
    let cartCount = 0;

    if (userId) {
      user = await User.findById(userId, "name _id email");
      const cart = await Cart.findOne({ userId });
      cartCount = cart
        ? cart.items.reduce((total, item) => total + item.quantity, 0)
        : 0;
    }
    console.log(categoryTypes)
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

// GET route to display all products for editing
router.get("/edit-product", checkAdminAuth, async (req, res) => {
  try {
    const products = await Product.find(
      {},
      "name MRP price front_image category brand bestseller sizes description color categoryType"
    )
      .populate("categoryType", "name _id")
      .lean();

    const updatedProducts = products.map(product => ({
      ...product,
      front_image: product.front_image || null,
    }));

    res.render("Admin/edit_product", {
      products: updatedProducts,
      activePage: "edit-product", // ✅ highlight correct sidebar link
      title: "Edit Product",      // optional, for page <title> or heading
    });
  } catch (error) {
    console.error("Error loading edit products:", error);
    res.status(500).send(`
      <script>
        alert('Failed to load products: ${error.message.replace(/'/g, "\\'")}');
        window.location.href = '/admin/dashboard';
      </script>
    `);
  }
});



// Product details

router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const userId = req.session.userId || req.cookies.userId;
    let user = { name: "Guest" };

    if (userId) {
      user = await User.findById(userId, "name _id");
    }

    const cartCount = req.session.cart ? req.session.cart.length : 0; // ✅ Add this line

    res.render("User/product_detail", {
      product,
      user,
      productId: product._id,
      cartCount, // ✅ Pass this to EJS
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

router.post(
  "/edit-product/:id",
  checkAdminAuth,
  uploads.any(),
  async (req, res) => {
    const { id } = req.params;
    try {
      const sizes = req.body.sizes || {};
      console.log("🟢 Edit request for product:", id);
      console.log("Received body:", req.body);
      console.log("Parsed sizes:", req.body.sizes);
      // ✅ Validate Product ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send(`
          <script>
            alert('Invalid product ID');
            window.location.href = '/products/edit-product';
          </script>
        `);
      }

      // ✅ Find existing product
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).send(`
          <script>
            alert('Product not found');
            window.location.href = '/products/edit-product';
          </script>
        `);
      }


      // 🧩 Parse color arrays
      const colorArray = req.body.color ? JSON.parse(req.body.color) : [];
      const deletedArray = req.body.deletedColors ? JSON.parse(req.body.deletedColors) : [];

      // 🧾 Build basic product fields
      const updateData = {
        name: req.body.name,
        description: req.body.description,
        MRP: req.body.MRP,
        price: req.body.price,
        brand: req.body.brand || "AsUsual",
        category: req.body.category || "",
        categoryType: req.body.categoryType || product.categoryType,
        bestseller: req.body.bestseller === "true",
        color: colorArray, // 🟣 colors array
        sizes: {
          xsmall: Number(sizes.xsmall) || 0,
          small: Number(sizes.small) || 0,
          medium: Number(sizes.medium) || 0,
          large: Number(sizes.large) || 0,
          xlarge: Number(sizes.xlarge) || 0,
          xxlarge: Number(sizes.xxlarge) || 0,
        },
      };

      // ✅ Helper: upload image to Cloudinary


      // ✅ Helper: get files by fieldname
      const getFilesByField = (fieldName) =>
        Array.isArray(req.files)
          ? req.files.filter((file) => file.fieldname === fieldName)
          : [];

      // 🟡 FRONT IMAGE
      const frontFiles = getFilesByField("front_image");
      if (frontFiles.length > 0)
        updateData.front_image = await uploadImage(frontFiles[0], product.front_image);
      else updateData.front_image = product.front_image;

      // 🟡 BACK IMAGE
      const backFiles = getFilesByField("back_image");
      if (backFiles.length > 0)
        updateData.back_image = await uploadImage(backFiles[0], product.back_image);
      else updateData.back_image = product.back_image;

      // 🟡 GALLERY IMAGES
      const galleryFiles = getFilesByField("images");
      if (galleryFiles.length > 0) {
        // delete old gallery
        for (const imgUrl of product.images || []) {
          const publicId = extractPublicIdFromUrl(imgUrl);
          if (publicId) await cloudinary.uploader.destroy(publicId);
        }
        const uploaded = await Promise.all(
          galleryFiles.map((file) => uploadImage(file))
        );
        updateData.images = uploaded;
      } else {
        updateData.images = product.images;
      }

      const updatedColorImages = {};

      // Keep existing colors (excluding deleted)
      for (const entry of product.colorImages || []) {
        if (!deletedArray.includes(entry.color)) {
          updatedColorImages[entry.color] = entry.images;
        } else {
          console.log(`🗑️ Removing images for deleted color: ${entry.color}`);
          for (const img of entry.images) {
            const publicId = extractPublicIdFromUrl(img);
            if (publicId) await cloudinary.uploader.destroy(publicId);
          }
        }
      }

      // Upload new colorImages (colorImages_<color>)
      for (const color of colorArray) {
        const files = getFilesByField(`colorImages_${color}`);
        if (files.length > 0) {
          const uploaded = await Promise.all(files.map((f) => uploadImage(f)));
          updatedColorImages[color] = uploaded;
        } else if (updatedColorImages[color]) {
          // Keep existing if not replaced
          console.log(`ℹ️ Keeping existing images for ${color}`);
        } else {
          // New color but no images uploaded
          updatedColorImages[color] = [];
        }
      }

      // Convert map → array for schema
      updateData.colorImages = Object.entries(updatedColorImages).map(
        ([color, images]) => ({ color, images })
      );

      console.log("✅ Final colorImages array:", updateData.colorImages);

      // 🟢 Update product in DB
      const updated = await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      console.log("✅ Product successfully updated:", updated?._id);

      return res.send(`
        <script>
          alert('Product updated successfully!');
          window.location.href = '/products/edit-product';
        </script>
      `);
    } catch (error) {
      console.error("❌ Error updating product:", error);
      return res.status(500).send(`
        <script>
          alert('Failed to update product: ${error.message.replace(/'/g, "\\'")}');
          window.location.href = '/products/edit-product/${id}';
        </script>
      `);
    }
  }
);
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