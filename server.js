const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT,
        image_url TEXT,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        shipping_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price_at_time REAL
    )`);

    // Seed sample data if empty
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare(`INSERT INTO products (name, description, price, category, stock) VALUES (?, ?, ?, ?, ?)`);
            const seeds = [
                ["Wireless Headphones", "Noise-canceling over-ear headphones", 129.99, "Electronics", 50],
                ["Mechanical Keyboard", "RGB backlit mechanical keyboard", 89.50, "Electronics", 30],
                ["4K Monitor 27\"", "Ultra HD IPS display", 349.00, "Electronics", 15],
                ["Cotton T-Shirt", "Organic cotton crewneck", 24.99, "Clothing", 100],
                ["Denim Jeans", "Slim fit dark wash", 59.00, "Clothing", 75],
                ["Running Shoes", "Lightweight mesh upper", 79.95, "Clothing", 60],
                ["Water Bottle", "Stainless steel 1L", 18.99, "Home", 200],
                ["Coffee Set", "Ceramic pour-over", 42.00, "Home", 40],
                ["Yoga Mat", "Non-slip 6mm thick", 32.00, "Sports", 80],
                ["Dumbbell Set", "Adjustable 20kg", 119.00, "Sports", 25]
            ];
            seeds.forEach(s => stmt.run(s));
            stmt.finalize();
        }
    });
});

// --- API Routes ---

// GET all products (with optional category filter)
app.get('/api/products', (req, res) => {
    const { category, search } = req.query;
    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (category && category !== 'All') {
        sql += " AND category = ?";
        params.push(category);
    }
    if (search) {
        sql += " AND (name LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET single product
app.get('/api/products/:id', (req, res) => {
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Product not found" });
        res.json(row);
    });
});

// POST register
app.post('/api/auth/register', async (req, res) => {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    db.run("INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)",
        [email, hash, full_name || null],
        function(err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    return res.status(409).json({ error: "Email already registered" });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, email });
        }
    );
});

// POST login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        const token = crypto.randomBytes(32).toString('hex');
        res.json({ token, user: { id: user.id, email: user.email, name: user.full_name } });
    });
});

// POST create order
app.post('/api/orders', (req, res) => {
    const { items, shipping_address, user_id } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: "No items in order" });

    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

    db.run("INSERT INTO orders (user_id, total, shipping_address) VALUES (?, ?, ?)",
        [user_id || null, total, shipping_address || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const orderId = this.lastID;

            const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)");
            items.forEach(item => stmt.run(orderId, item.id, item.qty, item.price));
            stmt.finalize();

            res.status(201).json({ order_id: orderId, total, status: "pending" });
        }
    );
});

// GET order by ID
app.get('/api/orders/:id', (req, res) => {
    db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: "Order not found" });

        db.all("SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", [req.params.id], (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...order, items });
        });
    });
});

// GET categories
app.get('/api/categories', (req, res) => {
    db.all("SELECT DISTINCT category FROM products ORDER BY category", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.category));
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});