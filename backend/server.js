const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
// body-parser.json() can be replaced by express.json() in modern Express
app.use(bodyParser.json()); 
app.use(express.json()); // Added for completeness, but bodyParser is still there.

// MongoDB Connection
// **WARNING**: Hardcoding the URI exposes your credentials. 
// Do not push this to a public repository!
mongoose.connect("mongodb+srv://sheenacan03:sheyn110903@cluster0.sj3w4az.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    // You might want to exit the process if the database connection fails
    // process.exit(1); 
});

// Schema & Model
const UserSchema = new mongoose.Schema({
    name: String,
    email: String
});

const User = mongoose.model("User", UserSchema);

// --- Routes ---
app.post("/api/users", async (req, res) => {
    const { name, email } = req.body;
    try {
        const newUser = new User({ name, email });
        await newUser.save();
        res.status(201).json(newUser);
    } catch (err) {
        // More descriptive error handling is usually better
        res.status(500).json({ error: "Failed to create user", details: err.message });
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users", details: err.message });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));