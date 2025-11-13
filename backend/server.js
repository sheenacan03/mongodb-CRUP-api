const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Use express's built-in JSON parser

// MongoDB Connection
// NOTE: Using the hardcoded URI from your original snippet.
// For production, use environment variables!
mongoose.connect("mongodb+srv://sheenacan03:sheyn110903@cluster0.sj3w4az.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    // Best practice to stop the server if the DB is down
    process.exit(1); 
});

// --- Schema & Model ---
// Added password and role for authentication purposes.
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // IMPORTANT: Use a hashing library like bcrypt in production!
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});

const User = mongoose.model("User", UserSchema);

// --- 1. Admin Initial Setup Route (One-time use) ---
// This route is for setting up your first admin user in the database.
app.post("/api/admin/setup", async (req, res) => {
    // You should restrict this in a real app!
    try {
        const { name, email, password } = req.body;
        const newAdmin = new User({ name, email, password, role: 'admin' });
        await newAdmin.save();
        res.status(201).json({ message: "Admin user created successfully!", user: newAdmin });
    } catch (err) {
        res.status(500).json({ error: "Failed to create admin", details: err.message });
    }
});
// To run this: POST to http://localhost:5000/api/admin/setup with name, email, password.

// --- 2. Customer Sign-Up (POST) ---
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Missing required fields (name, email, password)." });
    }
    try {
        const newUser = new User({ name, email, password, role: 'customer' });
        await newUser.save();
        // Respond with only safe info
        res.status(201).json({ id: newUser._id, name: newUser.name, email: newUser.email });
    } catch (err) {
        if (err.code === 11000) { // MongoDB duplicate key error (email is unique)
            return res.status(409).json({ message: "This email address is already registered." });
        }
        res.status(500).json({ error: "Failed to create user account", details: err.message });
    }
});

// --- 3. Admin Login (POST) ---
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, role: 'admin' });

        if (!user || user.password !== password) {
            // NOTE: In production, compare hashed passwords (e.g., using bcrypt.compare)
            return res.status(401).json({ message: "Invalid credentials or not an admin." });
        }
        // Successful login for admin
        res.json({ message: "Admin login successful", token: "fake-jwt-token", user: user.name });
    } catch (err) {
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});

// --- 4. Get All Customer Data (GET) ---
// This route is used by the Admin Data Management page.
app.get("/api/users", async (req, res) => {
    try {
        // Only fetch users with the 'customer' role
        const users = await User.find({ role: 'customer' }).select('-password -__v'); // Exclude password and version field
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch customer data", details: err.message });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));