const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; // To correctly use ObjectId in aggregation

const app = express();
const PORT = process.env.PORT || 5000; 

// --- Middleware Setup ---
// The live frontend domain should be configured here
const allowedOrigin = 'https://sheen.onrender.com'; 
const corsOptions = {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect("mongodb+srv://sheenacan03:sheyn110903@cluster0.sj3w4az.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); 
});

// =======================================================
// --- Schemas & Models (No changes needed here) ---
// =======================================================

// User Schema and Model
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});
const User = mongoose.model("User", UserSchema);

// Product Schema and Model
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: 'Gemstone Jewelry', trim: true }
}, { timestamps: true });
const Product = mongoose.model("Product", ProductSchema);

// CartItem Schema and Model
const CartItemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
}, { timestamps: true });

CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
const CartItem = mongoose.model("CartItem", CartItemSchema);


// =======================================================
// --- API Routes with Fixes --- 
// =======================================================

// --- User Routes (No changes) ---
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "User with this email already exists." });
        }
        const newUser = new User({ name, email, password, role });
        await newUser.save();
        res.status(201).json({ message: "User registered successfully!", user: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
    } catch (error) {
        res.status(500).json({ message: "Error registering user", error: error.message });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password }); 
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        res.status(200).json({ message: "Login successful", user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: "Error during login", error: error.message });
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

// --- Product Routes (Standard CRUD) ---
app.post("/api/products", async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: "Error creating product", error: error.message });
    }
});

app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
});

app.get("/api/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json(product);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        res.status(500).json({ message: "Error fetching product", error: error.message });
    }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json(updatedProduct);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        res.status(400).json({ message: "Error updating product", error: error.message });
    }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        await CartItem.deleteMany({ productId: req.params.id });
        res.status(200).json({ message: "Product and associated cart items deleted successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
});

app.get("/api/products/category/:category", async (req, res) => {
    try {
        const category = req.params.category;
        const products = await Product.find({ category: { $regex: new RegExp(category, 'i') } });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products by category", error: error.message });
    }
});

// ⭐ FIX: ADDED MISSING ROUTE for updating stock (Required for frontend logic)
app.put("/api/products/:productId/stock", async (req, res) => {
    try {
        const { stock } = req.body;
        
        // Ensure the new stock value is a valid non-negative number
        if (typeof stock !== 'number' || stock < 0) {
            return res.status(400).json({ message: "Invalid stock value provided." });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.productId,
            { stock: stock },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json(updatedProduct);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        // This 500 status often occurred in the original implementation
        res.status(500).json({ message: "Error updating product stock", error: error.message });
    }
});


// --- Cart Routes (CRITICAL FIXES HERE) ---

// 10. POST /api/cartitems - Add a product to the user's cart or update quantity
// ⭐ FIX: Updated logic to correctly use 'quantityChange' (+1 or -1) from the frontend
app.post("/api/cartitems", async (req, res) => {
    try {
        const { userId, productId, quantityChange } = req.body; 

        // Validate required fields
        if (!userId || !productId || typeof quantityChange !== 'number') {
            return res.status(400).json({ message: "Missing or invalid required cart fields (userId, productId, quantityChange)." });
        }

        // Find the existing cart item
        let cartItem = await CartItem.findOne({ userId, productId });

        if (cartItem) {
            // Item exists, update quantity
            cartItem.quantity += quantityChange;
            
            // CRITICAL CHECK: If quantity drops to 0 or below, delete the entry
            if (cartItem.quantity <= 0) {
                await CartItem.deleteOne({ _id: cartItem._id });
                return res.status(200).json({ message: "Cart item removed successfully (quantity reached zero)", cartItem: null });
            }

            await cartItem.save();
            res.status(200).json({ message: "Cart item quantity updated", cartItem });
        } else if (quantityChange > 0) {
            // Item does not exist, create new (only if adding)
            cartItem = new CartItem({ userId, productId, quantity: quantityChange });
            await cartItem.save();
            res.status(201).json({ message: "Product added to cart", cartItem });
        } else {
            // Attempted to remove an item that wasn't in the cart
            res.status(404).json({ message: "Cannot remove item: Product not found in cart." });
        }

    } catch (error) {
        // This is the error seen in the frontend: "Error adding/updating cart item"
        res.status(500).json({ message: "Error adding/updating cart item", error: error.message });
    }
});

// 11. GET /api/cartitems/:userId - Get the entire cart for a specific user
// ⭐ FIX: Uses aggregation/populate and formats the response structure for the frontend
app.get("/api/cartitems/:userId", async (req, res) => {
    try {
        const cartItems = await CartItem.find({ userId: req.params.userId })
            .populate('productId'); 
        
        // ⭐ CRITICAL FIX: Map the database objects into the simple structure the frontend expects
        const formattedCart = cartItems.map(item => ({
            id: item.productId._id, // Product ID is used as the unique identifier for UI manipulation
            name: item.productId.name,
            price: item.productId.price,
            quantity: item.quantity,
            cartItemId: item._id // The actual CartItem ID
        }));
        res.status(200).json(formattedCart);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        res.status(500).json({ message: "Error fetching cart", error: error.message });
    }
});

// ⭐ FIX: ADDED NEW ROUTE to fully remove an item by ProductId and UserId
// This is required for your `deleteItem(productId)` function in the frontend
app.delete("/api/cartitems/fullremove/:userId/:productId", async (req, res) => {
    try {
        const { userId, productId } = req.params;
        
        const result = await CartItem.findOneAndDelete({
            userId: userId,
            productId: productId
        });

        if (!result) {
            return res.status(404).json({ message: "Cart item not found for this user/product combination." });
        }

        res.status(200).json({ message: "Cart item fully removed successfully.", deletedItem: result });

    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid ID format" });
        }
        res.status(500).json({ message: "Error removing cart item.", error: error.message });
    }
});


// 14. DELETE /api/cartitems/:userId - Clear all items from a user's cart (Used for checkout)
app.delete("/api/cartitems/:userId", async (req, res) => {
    try {
        const result = await CartItem.deleteMany({ userId: req.params.userId });
        res.status(200).json({ message: `Cleared ${result.deletedCount} items from cart.`, result });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        res.status(500).json({ message: "Error clearing cart", error: error.message });
    }
});


// 404 Not Found JSON Fallback
app.use((req, res, next) => {
    res.status(404).json({ 
        message: `API endpoint not found for: ${req.originalUrl}`,
        status: 404 
    });
});


// --- Start Server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
