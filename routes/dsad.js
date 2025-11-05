const express = require("express");
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
// Middleware


// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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
  res.render("Admin/add_product");
});

router.post(
  "/add-product",
  uploads.fields([
    { name: "front_images", maxCount: 1 },
    { name: "back_image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      // Validate required fields
      const { name, description, price, brand, bestseller, color, category } = req.body;
      if (!name || !description || !price || !category) {
        return res.status(400).json({ 
          success: false,
          message: "Missing required fields" 
        });
      }

      // Validate files were uploaded
      if (!req.files || !req.files["front_images"] || !req.files["back_image"]) {
        return res.status(400).json({
          success: false,
          message: "Front and back images are required"
        });
      }

      // Process sizes
      const sizes = {
        xsmall: parseInt(req.body.sizes?.xsmall) || 0,
        small: parseInt(req.body.sizes?.small) || 0,
        medium: parseInt(req.body.sizes?.medium) || 0,
        large: parseInt(req.body.sizes?.large) || 0,
        xlarge: parseInt(req.body.sizes?.xlarge) || 0,
        xxlarge: parseInt(req.body.sizes?.xxlarge) || 0,
      };

      // Cloudinary upload function
      const uploadToCloudinary = async (file) => {
        return await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
          {
            resource_type: "auto",
            quality: "auto:best",
            fetch_format: "auto"
          }
        );
      };

      // Upload front image
      const frontImageResult = await uploadToCloudinary(req.files["front_images"][0]);

      // Upload back image
      const backImageResult = await uploadToCloudinary(req.files["back_image"][0]);

      // Upload additional images if they exist
      let additionalImagesResults = [];
      if (req.files["images"]) {
        additionalImagesResults = await Promise.all(
          req.files["images"].map(file => uploadToCloudinary(file))
        );
      }

      // Create product
      const product = new Product({
        name,
        description,
        sizes,
        price,
        brand,
        color,
        category,
        bestseller: bestseller === "on",
        front_image: frontImageResult.secure_url,
        back_image: backImageResult.secure_url,
        images: additionalImagesResults.map(img => img.secure_url),
      });

      await product.save();

       // Check if the request wants JSON response
      if (req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: "Product added successfully",
          productId: product._id
        });
      }

      return res.json({
        success: true,
        message: "Product added successfully",
        productId: product._id
      });

    } catch (error) {
      console.error("Error adding product:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to add product",
        error: error.message
      });
    }
  }
);


router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const userId = req.session.userId || req.cookies.userId;
    let user = { name: "Guest" };
    let cartCount = 0; // Initialize cart count

    if (userId) {
      user = await User.findById(userId, "name _id email phone createdAt");
      
      // Fetch cart count if user is logged in
      const cart = await Cart.findOne({ userId });
      if (cart) {
        cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
      }
    }

    res.render("User/product_detail", {
      product,
      user,
      productId: product._id,
      cartCount // Pass cartCount to the template
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// All products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: "desc" }).lean();
    const notification = (await Notification.findOne({})) || {
      notification: "",
    };
    const availableColors = [
      ...new Set(
        products
          .map((p) => p.color?.toLowerCase())
          .filter((color) => color)
      ),
    ];

    // Get user data if logged in
    const userId = req.session.userId || req.cookies.userId;
    let user = null;
    let cartCount = 0;

    if (userId) {
      user = await User.findById(userId, "name _id email");
      // Get cart count if needed
      const cart = await Cart.findOne({ userId });
      cartCount = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;
    }

    res.render("User/allProduct", {
      notification,
      products: products.map((p) => ({
        ...p,
        id: p._id.toString(),
      })),
      availableColors,
      user, // Pass user to template
      cartCount // Pass cart count if needed
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Error fetching products");
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
// Edit product form
// GET all products for editing
router.get('/edit-product', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.render('Admin/edit-product', { products }); // Assuming you're using a templating engine like EJS
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// GET edit product images page
router.get('/edit_product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.render('User/edit-product-images', { product }); // You'll need to create this view
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// POST update product
router.post('/edit-product/:id', upload.fields([
  { name: 'front_image', maxCount: 1 },
  { name: 'back_image', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {
    const { name, description, price, brand, category, bestseller } = req.body;
    const sizes = {
      xsmall: req.body.sizes?.xsmall || 0,
      small: req.body.sizes?.small || 0,
      medium: req.body.sizes?.medium || 0,
      large: req.body.sizes?.large || 0,
      xlarge: req.body.sizes?.xlarge || 0,
      xxlarge: req.body.sizes?.xxlarge || 0
    };

    const updateData = {
      name,
      description,
      price,
      brand,
      category,
      sizes,
      bestseller: bestseller === 'true'
    };

    // Handle file uploads
    if (req.files?.front_image) {
      updateData.front_image = '/uploads/products/' + req.files.front_image[0].filename;
    }
    if (req.files?.back_image) {
      updateData.back_image = '/uploads/products/' + req.files.back_image[0].filename;
    }
    if (req.files?.images) {
      updateData.images = req.files.images.map(file => '/uploads/products/' + file.filename);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }

    res.redirect('/products/edit-product');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
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