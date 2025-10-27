const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

router.get('/all', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// POST /admin/add-category
router.post("/add-category", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).send("Category name is required.");
    }

    // Check if category already exists
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).send("Category already exists.");
    }

    const newCategory = new Category({ name: name.trim(), description });
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

module.exports = router;
