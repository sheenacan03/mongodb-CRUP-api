const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; // To correctly use ObjectId in aggregation

const app = express();
// FIX 1: Use process.env.PORT for dynamic deployment (e.g., Render)
const PORT = process.env.PORT || 5000; 

// --- Middleware Setup ---
// FIX 2: Explicitly set CORS to only allow the live frontend domain
const allowedOrigin = 'https://sheen.onrender.com';
const corsOptions = {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
};
app.use(cors(corsOptions));
// CRITICAL: Middleware for parsing incoming JSON requests
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect("mongodb+srv://sheenacan03:sheyn110903@cluster0.sj3w4az.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    // Exit process on connection failure
    process.exit(1); 
});

// =======================================================
// --- Schemas & Models ---
// =======================================================

// User Schema and Model
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // IMPORTANT: Use bcrypt to hash passwords in a real app!
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

// Ensures a user can only have one of a specific product in their cart (quantity handled in route)
CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

const CartItem = mongoose.model("CartItem", CartItemSchema);


// =======================================================
// --- API Routes for User Management, Product, and Cart --- 
// =======================================================

// --- User Routes (3 Routes) ---

// 1. POST /api/users/register - Register a new user
app.post("/api/users/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        // Basic check for existing user
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

// 2. POST /api/users/login - User login (basic simulation)
app.post("/api/users/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        // Basic check, use bcrypt in production!
        const user = await User.findOne({ email, password }); 
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        res.status(200).json({ message: "Login successful", user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: "Error during login", error: error.message });
    }
});

// 3. GET /api/users - Get all users (Admin only route in a secured app)
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Don't expose passwords
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

// --- Product Routes (6 Routes) ---

// 4. POST /api/products - Create a new product (Admin only route in a secured app)
app.post("/api/products", async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: "Error creating product", error: error.message });
    }
});

// 5. GET /api/products - Get all products
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
});

// 6. GET /api/products/:id - Get a single product by ID
app.get("/api/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json(product);
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        res.status(500).json({ message: "Error fetching product", error: error.message });
    }
});

// 7. PUT /api/products/:id - Update a product by ID (Admin only route in a secured app)
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

// 8. DELETE /api/products/:id - Delete a product by ID (Admin only route in a secured app)
app.delete("/api/products/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Also remove all associated cart items to maintain data integrity
        await CartItem.deleteMany({ productId: req.params.id });
        res.status(200).json({ message: "Product and associated cart items deleted successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
});

// 9. GET /api/products/category/:category - Get products by category
app.get("/api/products/category/:category", async (req, res) => {
    try {
        const category = req.params.category;
        // Use regex for case-insensitive partial match
        const products = await Product.find({ category: { $regex: new RegExp(category, 'i') } });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products by category", error: error.message });
    }
});

// --- Cart Routes (6 Routes) ---

// 10. POST /api/cart - Add a product to the user's cart or update quantity
app.post("/api/cart", async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;

        // Check if item already exists
        let cartItem = await CartItem.findOne({ userId, productId });

        if (cartItem) {
            // Item exists, update quantity
            cartItem.quantity += quantity;
            await cartItem.save();
            res.status(200).json({ message: "Cart item quantity updated", cartItem });
        } else {
            // Item does not exist, create new
            cartItem = new CartItem({ userId, productId, quantity });
            await cartItem.save();
            res.status(201).json({ message: "Product added to cart", cartItem });
        }
    } catch (error) {
        res.status(500).json({ message: "Error adding/updating cart item", error: error.message });
    }
});

// 11. GET /api/cart/:userId - Get the entire cart for a specific user
app.get("/api/cart/:userId", async (req, res) => {
    try {
        // Populate the product details for display on the frontend
        const cartItems = await CartItem.find({ userId: req.params.userId })
            .populate('productId'); 
        res.status(200).json(cartItems);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        res.status(500).json({ message: "Error fetching cart", error: error.message });
    }
});

// 12. PUT /api/cart/:cartItemId - Update the quantity of a single cart item
app.put("/api/cart/:cartItemId", async (req, res) => {
    try {
        const { quantity } = req.body;
        const updatedItem = await CartItem.findByIdAndUpdate(
            req.params.cartItemId,
            { quantity: quantity },
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        res.status(200).json({ message: "Cart item quantity updated", updatedItem });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid cart item ID format" });
        }
        res.status(400).json({ message: "Error updating cart item", error: error.message });
    }
});

// 13. DELETE /api/cart/:cartItemId - Remove a single item from the cart
app.delete("/api/cart/:cartItemId", async (req, res) => {
    try {
        const deletedItem = await CartItem.findByIdAndDelete(req.params.cartItemId);
        if (!deletedItem) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        res.status(200).json({ message: "Cart item removed successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid cart item ID format" });
        }
        res.status(500).json({ message: "Error removing cart item", error: error.message });
    }
});

// 14. DELETE /api/cart/clear/:userId - Clear all items from a user's cart
app.delete("/api/cart/clear/:userId", async (req, res) => {
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

// 15. GET /api/cart/total/:userId - Calculate the total value of the cart (using aggregation)
app.get("/api/cart/total/:userId", async (req, res) => {
    try {
        // Use MongoDB aggregation to join CartItem with Product and calculate total
        const totalResult = await CartItem.aggregate([
            { $match: { userId: new ObjectId(req.params.userId) } },
            {
                $lookup: {
                    from: 'products', 
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: null,
                    // Calculate total price: quantity * product price
                    totalPrice: { $sum: { $multiply: ["$quantity", "$productDetails.price"] } },
                    totalItems: { $sum: "$quantity" }
                }
            }
        ]);

        const total = totalResult.length > 0 ? totalResult[0] : { totalPrice: 0, totalItems: 0 };
        res.status(200).json(total);
    } catch (error) {
        res.status(500).json({ message: "Error calculating cart total", error: error.message });
    }
});


// --- Start Server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
