const express = require('express');
const router = express.Router();

router.get('/customer', (req, res) => {
    const userCookie = req.cookies.user;
    const ticketId = req.query.ticketId;
    
    console.log('debug - Ticket ID from URL:', ticketId);
    
    if (userCookie) {
        try {
            const user = JSON.parse(userCookie);
            const email = user.email.toLowerCase();
            const db = req.app.locals.db;
            
            if (!db) {
                console.error('Database connection not available');
                return res.status(500).send('Database error');
            }
            
            if (!ticketId) {
                console.log('No ticketId provided, redirecting to customerDis');
                return res.redirect('/customerDis');
            }
            
            console.log(`Looking for ticket ${ticketId} for user ${email}`);
            
            // Get specific ticket for this user
            db.get('SELECT * FROM tickets WHERE id = ? AND LOWER(customerEmail) = ? AND stat = ?', 
                   [ticketId, email, 'complete'], (err, ticket) => {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).send('Database error');
                }
                
                if (!ticket) {
                    console.log(`Ticket ${ticketId} not found for user ${email}`);
                    return res.redirect('/customerDis');
                }
                
                console.log('✅ Ticket found! Processing repairs...');
                console.log('Raw recommendedRepairs field:', ticket.recommendedRepairs);
                
                // Parse repairs from the recommendedRepairs text field
                let repairs = [];
                try {
                    if (ticket.recommendedRepairs && ticket.recommendedRepairs.trim() !== '') {
                        // If it's JSON, parse it
                        if (ticket.recommendedRepairs.startsWith('[') || ticket.recommendedRepairs.startsWith('{')) {
                            repairs = JSON.parse(ticket.recommendedRepairs);
                        } else {
                            // If it's plain text, create a simple repair object
                            repairs = [{
                                repairDescription: ticket.recommendedRepairs,
                                qty: '',
                                partNumber: '',
                                partsTotal: 0,
                                laborTotal: 0
                            }];
                        }
                    }
                } catch (parseError) {
                    console.error('Error parsing recommendedRepairs:', parseError);
                    // Treat as plain text
                    repairs = [{
                        repairDescription: ticket.recommendedRepairs || 'No repairs listed',
                        qty: '',
                        partNumber: '',
                        partsTotal: 0,
                        laborTotal: 0
                    }];
                }
                
                console.log('Parsed repairs:', repairs);
                
                // Get vehicle info for this ticket
                db.get('SELECT * FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err, vehicle) => {
                    if (err) {
                        console.error('Vehicle info error:', err.message);
                        vehicle = {};
                    }
                    
                    console.log('Vehicle info found:', vehicle ? 'YES' : 'NO');
                    
                    // Calculate totals from repairs
                    let partsSubtotal = 0;
                    let laborSubtotal = 0;
                    
                    if (repairs && repairs.length > 0) {
                        repairs.forEach(repair => {
                            partsSubtotal += parseFloat(repair.partsTotal || 0);
                            laborSubtotal += parseFloat(repair.laborTotal || 0);
                        });
                    }
                    
                    const tax = partsSubtotal * 0.06;
                    const total = partsSubtotal + tax;
                    
                    console.log(`✅ Rendering customer page for ticket ${ticketId}`);
                    console.log(`   - Repairs to display: ${repairs.length}`);
                    
                    res.render('customer', {
                        user: user,
                        ticket: ticket,
                        repairs: repairs,
                        vehicle: vehicle || {},
                        totals: {
                            partsSubtotal: partsSubtotal.toFixed(2),
                            laborSubtotal: laborSubtotal.toFixed(2),
                            tax: tax.toFixed(2),
                            total: total.toFixed(2)
                        }
                    });
                });
            });
            
        } catch (error) {
            console.error('Cookie parsing error:', error);
            res.clearCookie('user');
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
});

router.post('/customer', (req, res) => {
    res.redirect('/customer');
});

module.exports = router;
