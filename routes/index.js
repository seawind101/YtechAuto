const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const userCookie = req.cookies.user;
    
    if (userCookie) {
        try {
            const user = JSON.parse(userCookie);
            const db = req.app.locals.db;
            
            // Check if user still exists in database
            db.get('SELECT id FROM users WHERE email = ?', [user.email], (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    res.clearCookie('user');
                    res.redirect('/login');
                } else if (row) {
                    // User exists in database, show main page
                    res.render('index', { user });
                } else {
                    // User doesn't exist in database, clear cookie and redirect
                    console.log(`User ${user.email} not found in database, clearing cookie`);
                    res.clearCookie('user');
                    res.redirect('/login');
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