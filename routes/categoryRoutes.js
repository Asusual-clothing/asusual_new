const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Product = require("../models/Product")
const multer = require("multer");
const cloudinary = require("cloudinary").v2;


const uploads = multer({ storage: multer.memoryStorage() });
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


const uploadImage = async (file, oldUrl = null) => {
  if (oldUrl) {
    const publicId = extractPublicIdFromUrl(oldUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  }

  const result = await cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
  );

  return result.secure_url;
};

router.get('/all', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// GET products by category

router.get("/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;

    // ✅ Find category
    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).send("Category not found");

    // ✅ Find products with this category
    const products = await Product.find({ categoryType: categoryId });

    // ✅ Prepare filter lists
    const availableColors = [...new Set(products.flatMap(p => p.color))];
    const categoryTypes = [category.name];

    res.render("User/categoryProducts", {
      products,
      categoryName: category.name,
      categoryImage: category.Image,
      categoryTypes,
      availableColors,
      user: req.user,
      cartCount: req.cartCount || 0
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});



router.get("/", async (req, res) => {
  const categories = await Category.find(); // assuming MongoDB
  res.render("User/categories", { categories });
});

router.post("/add-category", uploads.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    // 🔍 Validation
    if (!name || !file) {
      req.flash("error_msg", "Category name and image are required.");
      return req.session.save(() => res.redirect("/admin/delivery-cost"));
    }

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      req.flash("error_msg", "Category already exists.");
      return req.session.save(() => res.redirect("/admin/delivery-cost"));
    }

    // ✅ Upload image and save category
    const imageUrl = await uploadImage(file);
    const newCategory = new Category({
      name: name.trim(),
      description,
      Image: imageUrl,
    });
    await newCategory.save();

    // ✅ Flash success message
    req.flash("success_msg", "Category added successfully!");
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/admin/delivery-cost");
    });
  } catch (error) {
    console.error("Error adding category:", error);
    req.flash("error_msg", "Error adding category. Please try again.");
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/admin/delivery-cost");
    });
  }
});


// ✏️ EDIT CATEGORY
router.post("/edit/:id", uploads.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    const category = await Category.findById(req.params.id);
    if (!category) {
      req.flash("error_msg", "Category not found.");
      return res.redirect("/admin/delivery-cost");
    }

    let imageUrl = category.Image;
    if (file) {
      imageUrl = await uploadImage(file, category.Image);
    }

    category.name = name || category.name;
    category.description = description || category.description;
    category.Image = imageUrl;
    await category.save();

    // ✅ Flash success message and redirect
    req.flash("success_msg", "Category updated successfully!");
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/admin/delivery-cost");
    });
  } catch (error) {
    console.error("Error updating category:", error);
    req.flash("error_msg", "Error updating category. Please try again.");
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/admin/delivery-cost");
    });
  }
});

module.exports = router;
