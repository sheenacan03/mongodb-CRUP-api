const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; 

const app = express();
// FIX 1: Use process.env.PORT for Render deployment
const PORT = process.env.PORT || 5000; 

// Middleware: CRITICAL for JSON parsing.
// FIX 2: Explicitly set CORS to only allow the live frontend domain
const allowedOrigin = 'https://sheen.onrender.com';
const corsOptions = {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://sheenacan03:sheyn110903@cluster0.sj3w4az.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); 
});

// =======================================================
// --- Schemas & Models --- (Omitted for brevity - No changes needed here)
// =======================================================
// ... (User, Product, CartItem Schemas and Models remain the same) ...

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});
const User = mongoose.model("User", UserSchema);

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: 'Gemstone Jewelry', trim: true }
}, { timestamps: true });
const Product = mongoose.model("Product", ProductSchema);

const CartItemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
}, { timestamps: true });

CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

const CartItem = mongoose.model("CartItem", CartItemSchema);


// =======================================================
// --- API Routes for User Management, Product, and Cart --- 
// (Omitted for brevity - Routes 1-15 remain the same)
// =======================================================
// ... (All 15 API routes remain the same) ...

// Start Server
// FIX 1: Listen on the dynamic PORT variable
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
