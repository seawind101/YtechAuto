require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const router = express.Router();
const { ConfidentialClientApplication } = require("@azure/msal-node");
router.use(cookieParser());

const config = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

const msalClient = new ConfidentialClientApplication(config);

router.get("/login", (req, res) => {
    const authUrlParams = {
        scopes: ["user.read"],
        redirectUri: process.env.REDIRECT_URI,
    };

    msalClient.getAuthCodeUrl(authUrlParams).then(url => {
        res.redirect(url);
    });
});

router.get("/auth/callback", async (req, res) => {
    const tokenRequest = {
        code: req.query.code,
        scopes: ["user.read"],
        redirectUri: process.env.REDIRECT_URI,
    };

    try {
        const response = await msalClient.acquireTokenByCode(tokenRequest);
        const email = response.account.username;
        console.log(`${response.account.username}`);
        res.cookie('user', JSON.stringify({ email }), { 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        const db = req.app.locals.db;
        if (db) {
            // SQLite version - Insert or replace user in database
            
            try {
                db.run(`
                INSERT OR IGNORE INTO users ( email) 
                VALUES ( ?)`, [ email], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                    } else {
                        console.log(`User ${email} saved to database (Row ID: ${this.lastID})`);
                    }
                });
            } catch (dbError) {
                console.error('Database error:', dbError);
                // Continue with login even if DB fails
            }
        } else {
            console.error('Database connection not available');
        }
        
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Authentication Error");
    }
});

module.exports = router;