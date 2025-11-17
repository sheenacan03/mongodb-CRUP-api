const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; 

const app = express();
const PORT = 5000;

// Middleware: CRITICAL for JSON parsing.
app.use(cors());
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
// --- Schemas & Models ---
// =======================================================

// User Schema & Model
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});
const User = mongoose.model("User", UserSchema);

// Product Schema & Model
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: 'Gemstone Jewelry', trim: true }
}, { timestamps: true });
const Product = mongoose.model("Product", ProductSchema);


// Cart Item Schema & Model
const CartItemSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1 
    },
}, { timestamps: true });

CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

const CartItem = mongoose.model("CartItem", CartItemSchema);


// =======================================================
// --- API Routes for User Management (1-6) ---
// =======================================================

// 1. Admin Initial Setup (POST)
app.post("/api/admin/setup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(403).json({ message: "Admin user already exists. Setup blocked." });
        }
        const newAdmin = new User({ name, email, password, role: 'admin' });
        await newAdmin.save();
        res.status(201).json({ message: "Admin user created successfully!", user: newAdmin });
    } catch (err) {
        res.status(500).json({ error: "Failed to create admin", details: err.message });
    }
});

// 2. Customer Sign-Up (Create - POST)
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Missing required fields (name, email, password)." });
    }
    try {
        const newUser = new User({ name, email, password, role: 'customer' });
        await newUser.save();
        res.status(201).json({ id: newUser._id, name: newUser.name, email: newUser.email });
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "This email address is already registered." });
        }
        res.status(500).json({ error: "Failed to create user account", details: err.message });
    }
});

// 3. Admin Login (POST)
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, role: 'admin' });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials or not an admin." });
        }
        res.json({ message: "Admin login successful", user: { id: user._id, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});

// 4. READ All Users (GET)
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select('-password -__v');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user data", details: err.message });
    }
});

// 5. UPDATE User (PUT)
app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body; 
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { name, email, role },
            { new: true, runValidators: true }
        ).select('-password -__v');
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        
        res.json(updatedUser);
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "Email already exists." });
        }
        res.status(500).json({ error: "Failed to update user", details: err.message });
    }
});

// 6. DELETE User (DELETE)
app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }
    
    try {
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(200).json({ message: "User deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});

// =======================================================
// --- API Routes for Product Management (7-11) ---
// =======================================================

// 7. CREATE Product (POST) - Admin Only
app.post("/api/products", async (req, res) => {
    const { name, description, price, imageUrl, stock, category } = req.body;
    try {
        const newProduct = new Product({ name, description, price, imageUrl, stock, category });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ error: "Failed to create product", details: err.message });
    }
});

// 8. READ All Products (GET) - Public/Customer view
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find({}).select('-__v'); 
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
});

// 9. UPDATE Product (PUT) - Admin Only (General update)
app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body; 

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Product ID format." });
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-__v');

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: "Failed to update product", details: err.message });
    }
});

// 10. DELETE Product (DELETE) - Admin Only
app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Product ID format." });
    }

    try {
        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(200).json({ message: "Product deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
});

// 11. UPDATE Product Stock (PUT) - CRITICAL for stock management
app.put("/api/products/:id/stock", async (req, res) => {
    const { id } = req.params;
    const { stock } = req.body; 

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Product ID format." });
    }
    if (typeof stock !== 'number' || stock < 0) {
         return res.status(400).json({ message: "Invalid stock value provided. Stock must be a non-negative number." });
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { stock: stock },
            { new: true, runValidators: true }
        ).select('-__v');

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json(updatedProduct); 
    } catch (err) {
        console.error("Stock update failed:", err);
        res.status(500).json({ 
            error: "Failed to update product stock", 
            details: err.message 
        });
    }
});


// =======================================================
// --- API Routes for Cart Management (12-15) ---
// =======================================================

// 12. GET User's Cart (READ)
app.get("/api/cart/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        const cartItems = await CartItem.find({ userId })
            .populate('productId', 'name price stock imageUrl');

        const formattedCart = cartItems.map(item => ({
            id: item.productId._id,
            name: item.productId.name,
            price: item.productId.price,
            imageUrl: item.productId.imageUrl,
            availableStock: item.productId.stock, 
            quantity: item.quantity
        }));

        res.json(formattedCart);
    } catch (err) {
        console.error("Failed to fetch cart items:", err);
        res.status(500).json({ error: "Failed to fetch cart items", details: err.message });
    }
});


// 13. ADD/UPDATE Item in Cart (+1 or -1) - Used by the 'Add to Cart' button
app.post("/api/cart", async (req, res) => {
    const { userId, productId, quantityChange } = req.body; 

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId)) {
        return res.status(400).json({ message: "Invalid ID format." });
    }
    if (typeof quantityChange !== 'number' || Math.abs(quantityChange) !== 1) {
         return res.status(400).json({ message: "Invalid quantity change. Must be +1 or -1." });
    }

    try {
        let cartItem = await CartItem.findOne({ userId, productId });

        if (cartItem) {
            const newQuantity = cartItem.quantity + quantityChange;
            
            if (newQuantity <= 0) {
                 await CartItem.findByIdAndDelete(cartItem._id);
                 return res.status(200).json({ message: "Item removed from cart.", quantity: 0 });
            }
            
            cartItem.quantity = newQuantity;
            await cartItem.save();

        } else if (quantityChange > 0) {
            cartItem = new CartItem({ userId, productId, quantity: 1 });
            await cartItem.save();
        } else {
            return res.status(404).json({ message: "Cart item not found to decrement." });
        }
        
        const populatedItem = await CartItem.findOne({ userId, productId })
            .populate('productId', 'name price stock');

        res.status(200).json({ 
            message: "Cart updated successfully", 
            item: populatedItem ? { 
                id: populatedItem.productId._id,
                name: populatedItem.productId.name,
                quantity: populatedItem.quantity
            } : null
        });

    } catch (err) {
        console.error("Failed to update cart:", err);
        res.status(500).json({ error: "Failed to update cart", details: err.message });
    }
});


// 14. CLEAR User's Entire Cart (DELETE) - Used for checkout
app.delete("/api/cart/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        await CartItem.deleteMany({ userId });
        res.status(200).json({ message: "User cart cleared successfully." });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear cart", details: err.message });
    }
});

// 15. DELETE Specific Product Item Completely (NEW - Used by the 'Trash' icon)
app.delete("/api/cart/fullremove/:userId/:productId", async (req, res) => {
    const { userId, productId } = req.params;

    if (!ObjectId.isValid(userId) || !ObjectId.isValid(productId)) {
        return res.status(400).json({ message: "Invalid ID format." });
    }

    try {
        const deletedItem = await CartItem.findOneAndDelete({ userId, productId });
        
        if (!deletedItem) {
             return res.status(404).json({ message: "Cart item not found for removal." });
        }

        // CRITICAL: Return the quantity that was removed to restore stock
        res.status(200).json({ 
            message: "Product item removed entirely from cart.",
            quantityRemoved: deletedItem.quantity 
        });
    } catch (err) {
        console.error("Failed to remove item entirely:", err);
        res.status(500).json({ error: "Failed to remove item entirely from cart", details: err.message });
    }
});


// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));