require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const router = express.Router();
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { isAdmin } = require('../helpers/admins');
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
        const email = response.account.username.toLowerCase();
        console.log(`${response.account.username}`);
        res.cookie('user', JSON.stringify({ email }), { 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        const db = req.app.locals.db;
        if (db) {
            // Insert user if not exists, then fetch their id and stat, set session and role
            db.run(`INSERT OR IGNORE INTO users (email) VALUES (?)`, [email], function (err) {
                if (err) {
                    console.error('Database error on insert:', err);
                    // proceed without DB update
                    req.session.user = { email };
                    return res.redirect('/');
                }

                // fetch the user row to get id and existing stat
                db.get(`SELECT id, stat FROM users WHERE email = ? LIMIT 1`, [email], (gErr, row) => {
                    if (gErr) {
                        console.error('Database error fetching user:', gErr);
                        req.session.user = { email };
                        return res.redirect('/');
                    }

                    const userId = row && row.id ? row.id : null;
                    const currentStat = row && row.stat ? String(row.stat).toLowerCase() : null;
                    const role = isAdmin(email) ? 'admin' : 'customer';

                    const persistRoleAndRedirect = () => {
                        // set session user
                        req.session.user = { id: userId, email, stat: role };
                        return res.redirect('/');
                    };

                    if (userId == null) {
                        // no id -- just set session and continue
                        req.session.user = { email, stat: role };
                        return res.redirect('/');
                    }

                    if (currentStat !== role) {
                        db.run(`UPDATE users SET stat = ? WHERE id = ?`, [role, userId], (updErr) => {
                            if (updErr) console.error('Failed to update user stat:', updErr);
                            persistRoleAndRedirect();
                        });
                    } else {
                        // already has correct role
                        persistRoleAndRedirect();
                    }
                });
            });
        } else {
            console.error('Database connection not available');
            req.session.user = { email };
            res.redirect('/');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Authentication Error");
    }
});

router.post('/login', (req, res) => {
    const user = req.session.user;
    if (user) {
        const role = isAdmin(user.email) ? 'admin' : 'customer';
        const userId = user.id || user.ID || user.userId; // adapt to your user id field

        // Persist role to DB and set session
        req.app.locals.db.run(
          'UPDATE users SET stat = ? WHERE id = ?',
          [role, userId],
          (err) => {
            if (err) console.error('Failed to update user stat:', err);
            // ensure session reflects role even if DB update fails
            req.session.user = Object.assign({}, user, { stat: role });
            // continue original redirect or response
            return res.redirect('/'); // adjust as needed
          }
        );
    } else {
        res.status(401).send('Unauthorized');
    }
});

module.exports = router;