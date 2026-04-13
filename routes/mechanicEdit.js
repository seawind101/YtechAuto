const express = require('express');
const router = express.Router();
router.get('/mechanicEdit', (req, res) => {
    const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('mechanicEdit');} 
    else {
        res.redirect('/login');
        }
});

// return list of incomplete tickets as JSON
router.get('/mechanic/incomplete', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const sql = `SELECT id, date, techName, customerName, stat FROM tickets WHERE stat IS NULL OR stat != 'complete' ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Failed to fetch incomplete tickets', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        res.json(rows || []);
    });
});

// render the mechanic form populated with a ticket for editing
router.get('/mechanic/edit/:id', (req, res) => {
    const ticketId = req.params.id;
    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err) {
            console.error('Error fetching ticket:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!ticket) return res.status(404).send('Ticket not found');

        // fetch recommended repairs
        db.all('SELECT * FROM recRepairs WHERE ticketId = ?', [ticketId], (err2, repairs) => {
            if (err2) {
                console.error('Error fetching repairs:', err2);
                repairs = [];
            }

            // fetch vehicle info if present
            db.get('SELECT * FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err3, vehicle) => {
                if (err3) {
                    console.error('Error fetching vehicle info:', err3);
                    vehicle = null;
                }

                // attach additional arrays to ticket object for client-side population
                ticket.repairs = repairs || [];
                ticket.vehicle = vehicle || null;

                // render mechanic view and pass ticket data
                res.render('mechanic', { ticket });
            });
        });
    });
});
// GET /mechanic/edit/:id - Render edit form for a specific ticket
//router.get('/mechanic/edit/:id', (req, res) => {
   // const db = req.app.locals.db;
   // const ticketId = req.params.id;

    // Fetch ticket details from the database
   // db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
    //    if (err) {
     //       console.error('Error fetching ticket:', err);
     //       return res.status(500).send('Internal Server Error');
     //   }
      //  if (!ticket) {
      //      return res.status(404).send('Ticket not found');
       // }
        // Render the edit form with the ticket details
        //res.render('mechanicEdit', { ticket });
    //});
//});

// POST /mechanic/edit/:id - Handle form submission
//router.post('/mechanic/edit/:id', (req, res) => {
    //const db = req.app.locals.db;
   // const ticketId = req.params.id;
   // const { status, description } = req.body;

    // Update the ticket in the database
   // db.run('UPDATE tickets SET status = ?, description = ? WHERE id = ?', [status, description, ticketId], (err) => {
      //  if (err) {
      //      console.error('Error updating ticket:', err);
      //      return res.status(500).send('Internal Server Error');
      //  }
       // res.redirect(`/mechanic/ticket/${ticketId}`);
    //});
//});

module.exports = router;