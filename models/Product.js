    const mongoose = require('mongoose');

    const productSchema = new mongoose.Schema({
        name: { type: String, required: true },
        description: { type: String, required: true },
        MRP:{type: Number, required: true},
        price: { type: Number, required: true },
        color: { type: String, required: true},
        brand: { type: String, default: "AsUsual" },
        category: { type: String },  // Optional but useful
        sizes: {
            xsmall: {type: Number, default: 0 },
            small: { type: Number, default: 0 },
            medium: { type: Number, default: 0 },
            large: { type: Number, default: 0 },
            xlarge:{type: Number, default: 0 },
            xxlarge:{type:Number, default: 0}
        },  
        back_image:{ type: String, required:true},
        front_image:{ type: String, required: true}, 
        bestseller: { type: Boolean, default: false },
        images: [String], 
        createdAt: { type: Date, default: Date.now } // Stores the product's creation date
    });

    module.exports = mongoose.model('Product', productSchema);
