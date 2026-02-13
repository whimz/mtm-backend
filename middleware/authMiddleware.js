const db = require("../config/db")

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ error: "Token required" })
  }

  try {
    // Parse your simple token format "userId:email"
    const [userId, email] = token.split(":")

    if (!userId || !email) {
      return res.status(401).json({ error: "Invalid token format" })
    }

    // Verify user exists
    const user = await db.get("SELECT id, email FROM users WHERE id = ? AND email = ?", [userId, email])

    if (!user) {
      return res.status(401).json({ error: "Invalid token" })
    }

    // Attach user to request object for use in controllers
    req.user = user

    next()
  } catch (err) {
    console.error("Auth middleware error:", err)
    return res.status(500).json({ error: "Authentication failed" })
  }
}

module.exports = { authMiddleware }
