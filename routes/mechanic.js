const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const videoDir = path.join(__dirname, '..', 'upload', 'videos');
const imageDir = path.join(__dirname, '..', 'upload', 'images');
const signatureDir = path.join(__dirname, '..', 'upload', 'signatures');
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(signatureDir, { recursive: true });

// video storage
const videoStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, videoDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Only video files are allowed'));
    }
});

// image storage (matches video flow, uses field name 'image')
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, imageDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const imageUpload = multer({
    storage: imageStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// signature storage + multipart upload route
const signatureStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, signatureDir); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'signature-' + uniqueSuffix + ext);
  }
});

const signatureUpload = multer({
    storage: signatureStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

router.get('/mechanic', (req, res) => {
    const userCookie = req.cookies.user;
    if (!userCookie) return res.redirect('/login');

    const ticketId = req.query.id || req.query.ticketId;
    const db = req.app.locals.db;
    if (!ticketId) {
        return res.render('mechanic');
    }

    if (!db) return res.status(500).send('Database not available');

    // treat edit mode: if the query param `edit` is provided, respect it; otherwise default to edit mode for DB-loaded tickets
    const editParam = typeof req.query.edit !== 'undefined' ? String(req.query.edit).toLowerCase() : undefined;
    const explicitEdit = typeof editParam === 'undefined' ? true : (editParam === 'true' || editParam === '1' || editParam === 'yes');

    db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err) {
            console.error('Error fetching ticket:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (!ticket) return res.status(404).send('Ticket not found');

        db.all('SELECT * FROM recRepairs WHERE ticketId = ?', [ticketId], (err2, repairs) => {
            if (err2) {
                console.error('Error fetching repairs:', err2);
                repairs = [];
            }
            db.get('SELECT * FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err3, vehicle) => {
                if (err3) {
                    console.error('Error fetching vehicle info:', err3);
                    vehicle = null;
                }
                ticket.repairs = repairs || [];
                ticket.vehicle = vehicle || null;

                // scan all user tables and load rows that reference this ticket (by ticket id column)
                db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err4, tables) => {
                    const renderWithJoinedSections = () => {
                        const courtesyJoinSql = `
                          SELECT cti.*, ct.ticketID AS courtesyTicketID, ct.comments AS courtesyComments
                          FROM courtesyTableItems cti
                          INNER JOIN courtesyTable ct ON cti.tableID = ct.id
                          WHERE ct.ticketID = ?
                          ORDER BY cti.id ASC
                        `;
                        const steeringJoinSql = `
                          SELECT sst.*, ss.ticketID AS steeringTicketID
                          FROM steeringSuspensionTable sst
                          INNER JOIN steeringSuspension ss ON sst.steeringSuspensionID = ss.id
                          WHERE ss.ticketID = ?
                          ORDER BY sst.id ASC
                        `;

                        db.all(courtesyJoinSql, [ticketId], (cErr, courtesyRows) => {
                            if (cErr) {
                                console.error('Error loading courtesy joined rows:', cErr);
                            } else if (Array.isArray(courtesyRows) && courtesyRows.length) {
                                ticket.sections.courtesyTableItems = courtesyRows;
                            }

                            db.all(steeringJoinSql, [ticketId], (sErr, steeringRows) => {
                                if (sErr) {
                                    console.error('Error loading steering joined rows:', sErr);
                                } else {
                                    ticket.sections = ticket.sections || {};
                                    ticket.sections.steeringSuspensionTable = steeringRows || [];
                                }
                                return res.render('mechanic', { ticket, editMode: explicitEdit });
                            });
                        });
                    };

                    if (err4) {
                        console.error('Error fetching table list:', err4);
                        ticket.sections = {};
                        return renderWithJoinedSections();
                    }
                    ticket.sections = {};
                    if (!Array.isArray(tables) || tables.length === 0) return renderWithJoinedSections();

                    // process each table and collect rows where a ticketID-like column equals the ticketId
                    let pending = tables.length;
                    tables.forEach(trow => {
                        const tableName = trow && trow.name;
                        if (!tableName) {
                            if (--pending === 0) return renderWithJoinedSections();
                            return;
                        }

                        // skip the core tickets table to avoid recursion
                        if (tableName.toLowerCase() === 'tickets') {
                            if (--pending === 0) return renderWithJoinedSections();
                            return;
                        }

                        // inspect table columns to find a ticket identifier column
                        db.all(`PRAGMA table_info("${tableName}")`, [], (err5, cols) => {
                            if (err5 || !Array.isArray(cols)) {
                                if (err5) console.error('PRAGMA table_info error for', tableName, err5);
                                if (--pending === 0) return renderWithJoinedSections();
                                return;
                            }

                            // find a column whose name looks like ticket id (case-insensitive)
                            const colNames = cols.map(c => c && c.name).filter(Boolean);
                            const candidate = colNames.find(cn => {
                                const low = String(cn).toLowerCase();
                                return low === 'ticketid' || low === 'ticket_id' || (low.includes('ticket') && low.includes('id'));
                            });
                            if (!candidate) {
                                if (--pending === 0) return renderWithJoinedSections();
                                return;
                            }

                            // query rows matching this ticket id
                            const q = `SELECT * FROM "${tableName}" WHERE "${candidate}" = ?`;
                            db.all(q, [ticketId], (err6, rows2) => {
                                if (err6) {
                                    console.error('Failed to load rows from', tableName, 'by', candidate, err6);
                                } else if (rows2 && rows2.length) {
                                    // attach rows under the table name so client can render appropriately
                                    ticket.sections[tableName] = rows2;
                                }
                                if (--pending === 0) return renderWithJoinedSections();
                            });
                        });
                    });
                });
            });
        });
    });
});

router.post('/mechanic', (req, res) => {
    // collect fields
    const roNum = req.body.roNum;
    const roDate = req.body.roDate;
    const technician = req.body.technician;
    const timeArrive = req.body.timeIn;
    const timeOut = req.body.timeOut;
    const totTime = req.body.totTime;
    const custName = req.body.custName;
    const custAdd = req.body.custAddress;
    const custPhone = req.body.custPhone;
    const custEmail = req.body.custEmail;
    const concern = req.body.concern;
    const diagnosis = req.body.diagnosis;
    const sDate = req.body.sDate;
    const signature = req.body.signature;
    const ticketStatus = req.body.ticketStatus || 'open';

    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    // parse repairs
    let repairs = [];
    try { if (req.body.repairs) repairs = JSON.parse(req.body.repairs); } catch (e) { repairs = []; }

    const recommendedRepairsText = JSON.stringify(repairs || []);

    const insertTicketSql = `INSERT INTO tickets (date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const ticketParams = [roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate];

    db.run(insertTicketSql, ticketParams, function (err) {
    // Ensure schema has roNum column, then INSERT
    db.all("PRAGMA table_info('tickets')", [], (err, cols) => {
        if (err) {
            console.error('Failed to read tickets table info', err);
            return res.status(500).send('Database error');
        }
        const hasRepairOrderNumber = Array.isArray(cols) && cols.some(c => c && c.name === 'repairOrderNumber');
        const hasRo = Array.isArray(cols) && cols.some(c => c && c.name === 'roNum');

        const chooseAndInsert = (colName) => {
            const insertCols = `${colName}, date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned, stat`;
            const insertPlaceholders = Array(insertCols.split(',').length).fill('?').join(', ');
            const insertTicketSql = `INSERT INTO tickets (${insertCols}) VALUES (${insertPlaceholders})`;
            const ticketParams = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus];
            console.log('Inserting ticket with params:', ticketParams);

            db.run(insertTicketSql, ticketParams, function(err) {
                if (err) {
                    console.error('Failed to insert ticket:', err);
                    return res.status(500).send('Failed to save ticket');
                }

                const ticketId = this.lastID;
                console.log('Inserted ticket id', ticketId);

                if (!repairs || repairs.length === 0) return res.redirect('/mechanic?id=' + ticketId);

                const insertRecSql = `INSERT INTO recRepairs (ticketId, repairDescription, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const stmt = db.prepare(insertRecSql);
                repairs.forEach(r => {
                    const desc = r.repairDescription || '';
                    const qty = Number.isFinite(Number(r.qty)) ? parseInt(r.qty) : (r.qty ? parseInt(r.qty) : 0);
                    const partNumber = r.partNumber || '';
                    const partPrice = Number.isFinite(Number(r.partPrice)) ? parseFloat(r.partPrice) : (r.partPrice ? parseFloat(r.partPrice) : 0);
                    const partsTotal = Number.isFinite(Number(r.partsTotal)) ? parseFloat(r.partsTotal) : (r.partsTotal ? parseFloat(r.partsTotal) : (qty * partPrice));
                    const laborHours = Number.isFinite(Number(r.laborHours)) ? parseFloat(r.laborHours) : (r.laborHours ? parseFloat(r.laborHours) : 0);
                    const laborTotal = Number.isFinite(Number(r.laborTotal)) ? parseFloat(r.laborTotal) : (r.laborTotal ? parseFloat(r.laborTotal) : (laborHours * 100));

                    stmt.run([ticketId, desc, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal], (err) => {
                        if (err) console.error('Failed to insert recRepair row:', err);
                    });
                });
                stmt.finalize((err) => {
                    if (err) console.error('Failed finalizing recRepairs stmt:', err);
                    return res.redirect('/mechanic?id=' + ticketId);
                });
            });
        };

        if (hasRepairOrderNumber) return chooseAndInsert('repairOrderNumber');
        if (hasRo) return chooseAndInsert('roNum');

        // prefer adding repairOrderNumber to match existing schema expectations
        db.run("ALTER TABLE tickets ADD COLUMN repairOrderNumber TEXT", [], (err2) => {
            if (err2) console.error('Failed to add repairOrderNumber column to tickets table', err2);
            chooseAndInsert('repairOrderNumber');
        });
    });
});
});



router.post('/mechanic/vehicle-info', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

    const { ticketId, yearV, make, model, color, vin, mfgdate, engineSize, transType, mileageC, mileageO, dateV, plate, comments } = req.body;
    if (!ticketId) return res.status(400).json({ success: false, message: 'ticketId is required' });


    db.get('SELECT id FROM vechicleInfo WHERE ticketID = ?', [ticketId], (err2, row) => {
        if (err2) {
            console.error('DB select error:', err2);
            return res.status(500).json({ success: false, message: 'DB select error' });
        }

        if (row) {
            const upd = `UPDATE vechicleInfo SET yearV=?, make=?, model=?, color=?, vin=?, mfgdate=?, engineSize=?, transType=?, mileageC=?, mileageO=?, dateV=?, plate=?, comments=? WHERE ticketID=?`;
            const params = [yearV, make, model, color, vin, mfgdate, engineSize, transType, mileageC, mileageO, dateV, plate, comments, ticketId];
            db.run(upd, params, function (err3) {
                if (err3) {
                    console.error('Failed update vechicleInfo:', err3);
                    return res.status(500).json({ success: false, message: 'Update failed' });
                }
                // success: respond with No Content so client can remain unchanged
                return res.sendStatus(204);
            });
        } else {
            const sql = `INSERT INTO vechicleInfo (ticketID, yearV, make, model, color, vin, mfgdate, engineSize, transType, mileageC, mileageO, dateV, plate, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [ticketId, yearV, make, model, color, vin, mfgdate, engineSize, transType, mileageC, mileageO, dateV, plate, comments];
            db.run(sql, params, function (err4) {
                if (err4) {
                    console.error('Failed insert vechicleInfo:', err4);
                    return res.status(500).json({ success: false, message: 'Insert failed' });
                }
                // success: respond with No Content so client can remain unchanged
                return res.sendStatus(204);
            });
        }
    });
});

router.post('/mechanic/courtesy-check', (req, res) => {
  const db = req.app.locals.db;
  if (!db) return res.status(500).send('Database not available');

    // Accept JSON body { ticketId, items: [ { item, status, notes }, ... ], comments? }
    // or form field 'payload' containing that JSON string.
    let ticketId = req.body.ticketId || req.body.ticketID || req.query.ticketId;
    let items = req.body.items;
    let comments = req.body.comments || '';

    if (!items && req.body.payload) {
        try {
            const payload = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body.payload;
            items = payload.items || payload.data || null;
            comments = comments || payload.comments || '';
            ticketId = ticketId || payload.ticketId || payload.ticketID;
        } catch (e) {
            console.warn('courtesy-check payload parse failed:', e.message);
        }
    }

    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = null; }
    }

    if (!Array.isArray(items)) {
        const parsed = [];
        for (let i = 0; ; i++) {
            const item = req.body[`item_${i}`];
            const status = req.body[`status_${i}`];
            const notes = req.body[`notes_${i}`];
            if (typeof item === 'undefined') break;
            parsed.push({ item, status: status || '', notes: notes || '' });
        }
        items = parsed;
    }

    if (!ticketId) return res.status(400).json({ success: false, message: 'ticketId required' });

    const normalizedItems = (Array.isArray(items) ? items : []).map((entry) => ({
        item: (entry.item || entry.name || entry.label || '').toString().trim(),
        status: (entry.status || entry.state || '').toString().trim(),
        notes: (entry.notes || entry.note || '').toString().trim()
    })).filter((entry) => entry.item);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // delete any prior courtesy rows for this ticket (parent and children)
        db.all('SELECT id FROM courtesyTable WHERE ticketID = ?', [ticketId], (selErr, parentRows) => {
            if (selErr) {
                db.run('ROLLBACK');
                console.error('courtesy-check parent select failed:', selErr);
                return res.status(500).json({ success: false, message: 'Failed to load existing courtesy rows' });
            }

            const parentIds = (parentRows || []).map(r => r.id).filter(Boolean);
            const deleteChildrenAndParents = (done) => {
                const deleteParents = () => {
                    db.run('DELETE FROM courtesyTable WHERE ticketID = ?', [ticketId], (delParentErr) => {
                        if (delParentErr) return done(delParentErr);
                        done(null);
                    });
                };

                if (!parentIds.length) return deleteParents();
                let pending = parentIds.length;
                let hasErrored = false;
                parentIds.forEach((parentId) => {
                    db.run('DELETE FROM courtesyTableItems WHERE tableID = ?', [parentId], (delChildErr) => {
                        if (hasErrored) return;
                        if (delChildErr) {
                            hasErrored = true;
                            return done(delChildErr);
                        }
                        pending -= 1;
                        if (pending === 0) deleteParents();
                    });
                });
            };

            deleteChildrenAndParents((deleteErr) => {
                if (deleteErr) {
                    db.run('ROLLBACK');
                    console.error('courtesy-check delete failed:', deleteErr);
                    return res.status(500).json({ success: false, message: 'Failed to clear old courtesy rows' });
                }

                // create one parent row in courtesyTable for this save
                const parentItemLabel = 'Courtesy Check';
                db.run(
                    'INSERT INTO courtesyTable (ticketID, item, comments) VALUES (?, ?, ?)',
                    [ticketId, parentItemLabel, comments || ''],
                    function (insertParentErr) {
                        if (insertParentErr) {
                            db.run('ROLLBACK');
                            console.error('courtesy-check parent insert failed:', insertParentErr);
                            return res.status(500).json({ success: false, message: 'Failed to save courtesy header' });
                        }

                        const tableID = this.lastID;
                        if (!normalizedItems.length) {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error('courtesy-check commit failed:', commitErr);
                                    return res.status(500).json({ success: false, message: 'Failed to finalize courtesy save' });
                                }
                                return res.sendStatus(204);
                            });
                            return;
                        }

                        const stmt = db.prepare('INSERT INTO courtesyTableItems (tableID, item, status, notes) VALUES (?, ?, ?, ?)');
                        let pendingInserts = normalizedItems.length;
                        let insertFailed = false;

                        normalizedItems.forEach((entry) => {
                            stmt.run([tableID, entry.item, entry.status, entry.notes], (itemErr) => {
                                if (insertFailed) return;
                                if (itemErr) {
                                    insertFailed = true;
                                    stmt.finalize(() => {
                                        db.run('ROLLBACK');
                                        console.error('courtesy-check child insert failed:', itemErr);
                                        return res.status(500).json({ success: false, message: 'Failed to save courtesy items' });
                                    });
                                    return;
                                }
                                pendingInserts -= 1;
                                if (pendingInserts === 0) {
                                    stmt.finalize((finErr) => {
                                        if (finErr) {
                                            db.run('ROLLBACK');
                                            console.error('courtesy-check finalize failed:', finErr);
                                            return res.status(500).json({ success: false, message: 'Failed to finalize courtesy items' });
                                        }
                                        db.run('COMMIT', (commitErr) => {
                                            if (commitErr) {
                                                console.error('courtesy-check commit failed:', commitErr);
                                                return res.status(500).json({ success: false, message: 'Failed to finalize courtesy save' });
                                            }
                                            return res.sendStatus(204);
                                        });
                                    });
                                }
                            });
                        });
                    }
                );
            });
        });
    });
});

router.post('/mechanic/tires', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });

    // defensive body normalization: accept req.body (may be undefined), req.query, or JSON string body
    let body = req.body || {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const query = req.query || {};

    const ticketId = body.ticketId || body.ticketID || query.ticketId || query.ticketID;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

    // accept multiple possible field names from the client (case-insensitive variations)
    const size = body.size || body.tireSize || body.Size || null;
    const speedRating = body.speedRating || body.speed || body.SpeedRating || null;
    const LF = body.LF || body.tireLF || body.leftFront || null;
    const RF = body.RF || body.tireRF || body.rightFront || null;
    const LR = body.LR || body.tireLR || body.leftRear || null;
    const RR = body.RR || body.tireRR || body.rightRear || null;
    const SP = body.SP || body.tireSpare || body.spare || null;
    const treadDepth32 = body.treadDepth32 || body.treadDepth || body.tread || null;
    const rotationDue = body.rotationDue || body.rotationD || body.rotation || null;
    const balance = body.balanceDue || body.balanace || body.bal || null;
    const alignment = body.alignmentCheck || body.alignmentC || body.align || null;
    const comments = body.tireComments || body.comment || null;

    const params = [size, speedRating, LF, RF, LR, RR, SP, treadDepth32, rotationDue, balance, alignment, comments, ticketId];

    // Check if record already exists
    db.get('SELECT id FROM tires WHERE ticketID = ?', [ticketId], (err, row) => {
        if (err) {
            console.error('Failed to check existing tires info:', err);
            return res.status(500).json({ error: 'Failed to check existing tires info' });
        }

        if (row) {
            // Update existing record
            const updateSql = `UPDATE tires SET size = ?, speedRating = ?, LF = ?, RF = ?, LR = ?, RR = ?, SP = ?, treadDepth32 = ?, rotationDue = ?, balance = ?, alignment = ?, comments = ? WHERE ticketID = ?`;
            db.run(updateSql, params, function(err) {
                if (err) {
                    console.error('Failed to update tires info:', err);
                    return res.status(500).json({ error: 'Failed to update tires info' });
                }
                return res.sendStatus(204);
            });
        } else {
            // Insert new record
            const insertSql = `INSERT INTO tires (ticketID, size, speedRating, LF, RF, LR, RR, SP, treadDepth32, rotationDue, balance, alignment, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const insertParams = [ticketId, ...params.slice(0, -1)];
            db.run(insertSql, insertParams, function(err) {
                if (err) {
                    console.error('Failed to save tires info:', err);
                    return res.status(500).json({ error: 'Failed to save tires info' });
                }
                return res.sendStatus(204);
            });
        }
    });
});

// video upload route 
router.post('/upload-video', videoUpload.single('video'), (req, res) => {
    const db = req.app.locals.db;
    if (!db) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(500).json({ success: false, message: 'Database not available' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file = req.file;
    const relativePath = path.relative(path.join(__dirname, '..'), file.path).split(path.sep).join('/');
    const insertSql = `INSERT INTO videos (ticketID, filename, originalName, relativePath, mimeType, sizeBytes, uploadDate)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
    const params = [req.body.ticketID || null, file.filename, file.originalname, relativePath, file.mimetype, file.size];

    db.run(insertSql, params, function (err) {
        if (err) {
            console.error('DB insert failed, removing uploaded file:', err);
            // remove the saved file to avoid orphan
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Failed to unlink file after DB error:', unlinkErr);
                return res.status(500).json({ success: false, message: 'Database error' });
            });
            return;
        }
        // success
        res.json({ success: true, id: this.lastID, path: relativePath });
    });
});

// image upload route
router.post('/upload-image', imageUpload.array('image'), (req, res) => {
    const db = req.app.locals.db;
    if (!db) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(500).json({ success: false, message: 'Database not available' });
    }
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No files uploaded' });

    const results = [];
    let pending = req.files.length;

    req.files.forEach((file) => {
        const relativePath = path.relative(path.join(__dirname, '..'), file.path).split(path.sep).join('/');
        const insertSql = `INSERT INTO pictures (ticketID, filename, originalName, relativePath, mimeType, sizeBytes, uploadDate)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
        const params = [req.body.ticketID || null, file.filename, file.originalname, relativePath, file.mimetype, file.size];

        db.run(insertSql, params, function (err) {
            if (err) {
                console.error('upload-image: DB insert failed for', file.filename, err);
                // remove file to avoid orphans
                try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
                results.push({ success: false, filename: file.filename, error: err.message });
            } else {
                results.push({ success: true, id: this.lastID, filename: file.filename, path: relativePath });
            }

            pending -= 1;
            if (pending === 0) {
                return res.json({ success: true, files: results });
            }
        });
    });
});

//signitures upload route
router.post('/upload-signature', signatureUpload.single('signature'), (req, res) => {
    const db = req.app.locals.db;
    if (!db) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(500).json({ success: false, message: 'Database not available' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file = req.file;
    const relativePath = path.relative(path.join(__dirname, '..'), file.path).split(path.sep).join('/');
    const insertSql = `INSERT INTO signatures (ticketID, filename, originalName, relativePath, uploadDate)
                     VALUES (?, ?, ?, ?, datetime('now'))`;
    const params = [req.body.ticketID || null, file.filename, file.originalname, relativePath];

    db.run(insertSql, params, function (err) {
        if (err) {
            console.error('DB insert failed, removing uploaded file:', err);
            // remove the saved file to avoid orphan
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Failed to unlink file after DB error:', unlinkErr);
                return res.status(500).json({ success: false, message: 'Database error' });
            });
            return;
        }
        // success
        res.json({ success: true, id: this.lastID, path: relativePath });
    });
});

module.exports = router;
