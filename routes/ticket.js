const express = require('express');
const router = express.Router();

// GET /ticket/:id - Render ticket details page
router.get('/ticket/:id', (req, res) => {
    const db = req.app.locals.db;
    const ticketId = req.params.id;
    
    // Fetch ticket details from the database
    db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err) {
            console.error('Error fetching ticket:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!ticket) {
            return res.status(404).send('Ticket not found');
        }
        // Render the ticket details page
        res.render('ticket', { ticket });
    });
});

module.exports = router;
