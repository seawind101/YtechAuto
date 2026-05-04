const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const userCookie = req.cookies.user;
    
    if (userCookie) {
        try {
            const parsed = JSON.parse(userCookie);
            const db = req.app.locals.db;

            // Check if user still exists in database and fetch stat
            db.get('SELECT id, stat FROM users WHERE email = ? LIMIT 1', [parsed.email], (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    res.clearCookie('user');
                    res.redirect('/login');
                } else if (row) {
                    // User exists in database, pass id/email/stat to view
                    const user = { id: row.id, email: parsed.email, stat: row.stat };
                    return res.render('index', { user });
                } else {
                    // User doesn't exist in database, clear cookie and redirect
                    console.log(`User ${parsed.email} not found in database, clearing cookie`);
                    res.clearCookie('user');
                    return res.redirect('/login');
                }
            });
        } catch (error) {
            // Invalid cookie format
            res.clearCookie('user');
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
});

module.exports = router;