const db = require('../config/db');

async function register(req, res) {
  const { email, password } = req.body;
  try {
    await db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password]);
    const user = await db.get("SELECT id, email FROM users WHERE email = ?", [email]);
    const token = `${user.id}:${user.email}`;
    res.json({ token });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(400).json({ error: "User already exists" });
  }
}

async function login (req, res) {
  const { email, password } = req.body;
  try {
    const user = await db.get("SELECT id, email FROM users WHERE email = ? AND password = ?", [email, password]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const token = `${user.id}:${user.email}`;
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function checkAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "No token provided" });

  const [id, email] = auth.split(':');
  try {
    const user = await db.get("SELECT id, email FROM users WHERE id = ? AND email = ?", [id, email]);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    res.json(user);
  } catch (err) {
    console.error('Auth check error:', err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function logout() {
  
}

module.exports = {
  register,
  login,
  checkAuth,
  logout
}