const mongoose = require('mongoose');
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    Image:{type:String, required:true}
  });
  
  module.exports = mongoose.model("Category", CategorySchema);