const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
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

router.get("/", async (req, res) => {
  const categories = await Category.find(); // assuming MongoDB
  res.render("User/categories", { categories });
});

router.post("/add-category", uploads.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).send("Category name and image are required.");
    }

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).send("Category already exists.");
    }

    const imageUrl = await uploadImage(file);
    const newCategory = new Category({ name: name.trim(), description, Image: imageUrl });
    await newCategory.save();

    res.send(`
      <script>
        alert("Category added successfully!");
        window.location.href = "/admin/delivery-cost";
      </script>
    `);
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ✏️ EDIT CATEGORY
router.post("/edit/:id", uploads.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).send("Category not found.");
    }

    let imageUrl = category.Image;
    if (file) {
      imageUrl = await uploadImage(file, category.Image);
    }

    category.name = name || category.name;
    category.description = description || category.description;
    category.Image = imageUrl;
    await category.save();

    res.send(`
      <script>
        alert("Category updated successfully!");
        window.location.href = "/admin/delivery-cost";
      </script>
    `);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).send("Internal Server Error");
  }
});
module.exports = router;
