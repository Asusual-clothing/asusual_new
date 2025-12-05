const express = require("express");
const router = express.Router();
const Offer = require("../models/OfferSchema");
const Product = require("../models/Product");
const Admin = require("../models/AdminSchema")
const CategoryCoupon = require("../models/categoryCoupon")
const Category = require("../models/Category")
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

// 🟢 GET: Show Offer Creation Page + List All Offers
router.get("/", checkAdminAuth, async (req, res) => {
  try {
    const products = await Product.find({}, "name price front_image");
    const offers = await Offer.find()
      .populate("productIds", "name price front_image")
      .populate("freeProductId", "name front_image")
      .sort({ createdAt: -1 });

    res.render("Admin/createOffer", {
      products,
      offers,
      activePage: "offers" // 👈 define this
    });

  } catch (err) {
    console.error("Error loading offers page:", err);
    res.status(500).send("Server Error");
  }
});

// 🟢 POST: Create New Offer
router.post("/", async (req, res) => {
  try {
    const {
      name,
      productIds,
      minQuantity,
      offerType,
      offerValue,
      freeProductId,
      expiryDate
    } = req.body;

    // Handle multiple productIds (in case only one is selected)
    const productArray = Array.isArray(productIds)
      ? productIds
      : [productIds];

    const newOffer = new Offer({
      name,
      productIds: productArray,
      minQuantity,
      offerType,
      offerValue: offerValue || null,
      freeProductId: freeProductId || null,
      expiryDate
    });

    await newOffer.save();
    res.redirect("/offers");
  } catch (err) {
    console.error("Error creating offer:", err);
    res.status(500).send("Error creating offer");
  }
});

// 🟡 GET: Edit Offer Page
router.get("/edit/:id", checkAdminAuth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate("productIds", "name price front_image")
      .populate("freeProductId", "name price front_image");

    if (!offer) return res.status(404).send("Offer not found");

    const products = await Product.find({}, "name price front_image");
    const offers = await Offer.find()
      .populate("productIds", "name price front_image")
      .populate("freeProductId", "name front_image")
      .sort({ createdAt: -1 });

    // Render same form but prefilled
    res.render("Admin/edit-offer", { offer, products, offers, activePage: "offers" });
  } catch (err) {
    console.error("Error loading edit page:", err);
    res.status(500).send("Server Error");
  }
});

// 🟠 POST: Update Offer
router.post("/edit/:id", async (req, res) => {
  try {
    const {
      name,
      productIds,
      minQuantity,
      offerType,
      offerValue,
      freeProductId,
      expiryDate
    } = req.body;

    const productArray = Array.isArray(productIds)
      ? productIds
      : [productIds];

    await Offer.findByIdAndUpdate(req.params.id, {
      name,
      productIds: productArray,
      minQuantity,
      offerType,
      offerValue: offerValue || null,
      freeProductId: freeProductId || null,
      expiryDate
    });

    res.redirect("/offers");
  } catch (err) {
    console.error("Error updating offer:", err);
    res.status(500).send("Error updating offer");
  }
});

// 🟢 POST: Toggle Offer Active/Inactive
router.post("/toggle-active/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).send("Offer not found");

    offer.active = !offer.active;
    await offer.save();
    res.redirect("/offers");
  } catch (err) {
    console.error("Error toggling offer:", err);
    res.status(500).send("Error toggling offer");
  }
});

// 🔴 POST: Delete Offer
router.post("/delete/:id", async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.redirect("/offers");
  } catch (err) {
    console.error("Error deleting offer:", err);
    res.status(500).send("Error deleting offer");
  }
});

router.get('/categorycoupon', async (req, res) => {
  const categories = await Category.find();
  const categoryCoupons = await CategoryCoupon.find()
    .populate('categoryId')
    .sort({ createdAt: -1 });

  res.render('Admin/categorycoupon', {
    categories,
    categoryCoupons,
    activePage: 'categorycoupon'
  });

});
router.get('/categorycoupon/edit/:id', async (req, res) => {
  const categories = await Category.find();
  const coupon = await CategoryCoupon.findById(req.params.id).populate('categoryId');

  if (!coupon) {
    req.flash('error', 'Coupon not found');
    return res.redirect('/categorycoupon');
  }

  res.render('Admin/editcategorycoupon', {
    categories,
    coupon,               // ✔ send the specific coupon
    activePage: 'categorycoupon'
  });
});



router.post('/categorycoupon', async (req, res) => {
  await CategoryCoupon.create(req.body);
  req.flash('success', 'Category Coupon Created');
  res.redirect('/offers/categorycoupon');
});

router.post('/categorycoupon/edit/:id', async (req, res) => {
  const { name, categoryId, offerType, offerValue, expiryDate } = req.body;

  await CategoryCoupon.findByIdAndUpdate(req.params.id, {
    name,
    categoryId,
    offerType,
    offerValue,
    expiryDate
  });

  req.flash('success', 'Coupon Updated');
  res.redirect('/offers/categorycoupon');
});
// Toggle
router.post('/categorycoupon/toggle/:id', async (req, res) => {
  const coupon = await CategoryCoupon.findById(req.params.id);
  console.log(coupon.active)
  coupon.active = !coupon.active;
  console.log(coupon.active)
  
  await coupon.save();

  res.redirect('/offers/categorycoupon');
});

// Delete
router.post('/categorycoupon/delete/:id', async (req, res) => {
  await CategoryCoupon.findByIdAndDelete(req.params.id);
  res.redirect('/offers/categorycoupon');
});



module.exports = router;
