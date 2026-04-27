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

// save signature dataURL to signatures table (insert -> write -> update)
async function saveSignatureFromDataUrl(db, dataUrl, clientName) {
    return new Promise((resolve, reject) => {
        if (!dataUrl || typeof dataUrl !== 'string') return resolve(null);
        const comma = dataUrl.indexOf(',');
        if (comma === -1) return resolve(null);
        const b64 = dataUrl.slice(comma + 1);
        let buffer;
        try { buffer = Buffer.from(b64, 'base64'); } catch (e) { return resolve(null); }

        const ensureSql = `
          CREATE TABLE IF NOT EXISTS signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketID INTEGER,
            filename TEXT NOT NULL,
            originalName TEXT NOT NULL,
            relativePath TEXT NOT NULL,
            uploadDate TEXT DEFAULT (datetime('now'))
          )`;
        db.run(ensureSql, (ensureErr) => {
            if (ensureErr) return reject(ensureErr);

            const tempName = `signature-pending-${Date.now()}.tmp`;
            const tempRel = path.join('upload', 'signatures', tempName).split(path.sep).join('/');
            const insertSql = `INSERT INTO signatures (ticketID, filename, originalName, relativePath, uploadDate)
                               VALUES (?, ?, ?, ?, datetime('now'))`;
            db.run(insertSql, [null, tempName, clientName || tempName, tempRel], function (insertErr) {
                if (insertErr) return reject(insertErr);
                const sigId = this.lastID;
                const finalName = (clientName && path.basename(String(clientName))) || `signature-${sigId}.png`;
                const savePath = path.join(signatureDir, finalName);
                fs.writeFile(savePath, buffer, (writeErr) => {
                    if (writeErr) {
                        // remove placeholder row on failure
                        db.run('DELETE FROM signatures WHERE id = ?', [sigId], () => {
                            return reject(writeErr);
                        });
                        return;
                    }
                    const relPath = path.relative(path.join(__dirname, '..'), savePath).split(path.sep).join('/');
                    const updateSql = `UPDATE signatures SET filename = ?, relativePath = ? WHERE id = ?`;
                    db.run(updateSql, [finalName, relPath, sigId], function (updErr) {
                        if (updErr) {
                            try { fs.unlinkSync(savePath); } catch (e) { /* ignore */ }
                            db.run('DELETE FROM signatures WHERE id = ?', [sigId], () => {
                                return reject(updErr);
                            });
                            return;
                        }
                        return resolve({ id: sigId, filename: finalName, relativePath: relPath });
                    });
                });
            });
        });
    });
}

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

// image storage 
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

// signature storage 
const signatureStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, signatureDir); },
    filename: function (req, file, cb) {
        let name = (req.body && req.body.signatureFilename) || file.originalname || 'signature.png';
        name = path.basename(String(name));
        name = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
        cb(null, name);
    }
});

const signatureUpload = multer({
    storage: signatureStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
                                                    SELECT sst.*, ss.ticketID AS steeringTicketID, ss.comments AS steeringComments
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

                                // also load brakes joined rows (parent comments + child rows)
                                const brakesJoinSql = `
                                  SELECT bt.*, b.ticketID AS brakesTicketID, b.comments AS brakesComments
                                  FROM brakesTable bt
                                  INNER JOIN brakes b ON bt.brakesID = b.id
                                  WHERE b.ticketID = ?
                                  ORDER BY bt.id ASC
                                `;
                                db.all(brakesJoinSql, [ticketId], (bErr, brakesRows) => {
                                    if (bErr) {
                                        console.error('Error loading brakes joined rows:', bErr);
                                    } else if (Array.isArray(brakesRows) && brakesRows.length) {
                                        ticket.sections = ticket.sections || {};
                                        ticket.sections.brakesTable = brakesRows;
                                    }
                                    return res.render('mechanic', { ticket, editMode: explicitEdit });
                                });
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

router.post('/mechanic', async (req, res) => {
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

    // try to save signature first (uses req.body.signature dataURL if present)
    let savedSignature = null;
    try {
        if (signature) {
            savedSignature = await saveSignatureFromDataUrl(db, signature, req.body.signatureFilename || req.body.signatureFileName || 'signature.png');
            if (savedSignature) console.log('Saved signature before ticket insert:', savedSignature);
        }
    } catch (sigErr) {
        console.error('Failed to save signature before ticket insert:', sigErr);
        return res.status(500).send('Failed to save signature');
    }

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
            const hasCustomerSignature = Array.isArray(cols) && cols.some(c => c && c.name === 'customerSignature');
            const chooseAndInsert = (colName) => {
                // include customerSignature column if present
                const extraCol = hasCustomerSignature ? ', customerSignature' : '';
                const insertCols = `${colName}, date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned${extraCol}, stat`;
                const insertPlaceholders = Array(insertCols.split(',').length).fill('?').join(', ');
                const insertTicketSql = `INSERT INTO tickets (${insertCols}) VALUES (${insertPlaceholders})`;
                const ticketParams = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate];
                if (hasCustomerSignature) {
                    ticketParams.push(savedSignature ? savedSignature.relativePath : null);
                }
                ticketParams.push(ticketStatus);
                console.log('Inserting ticket with params:', ticketParams);

                db.run(insertTicketSql, ticketParams, function (err) {
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
                stmt.finalize((err) => {
                    if (err) console.error('Failed finalizing recRepairs stmt:', err);
                    if (ticketId) {
                        return res.redirect('/mechanic?id=' + ticketId);
                    }
                    else {
                        console.warn('No ticket ID after insert');
                        return res.send('Ticket created, but failed to retrieve ID for repairs insertion. Please check your form ensure all fields are filled. RO Number must be unique as well');
                    }
                });
            };
        });
    });

    if (hasRepairOrderNumber) return chooseAndInsert('repairOrderNumber');
    if (hasRo) return chooseAndInsert('roNum');

    // prefer adding repairOrderNumber to match existing schema expectations
    db.run("ALTER TABLE tickets ADD COLUMN repairOrderNumber TEXT", [], (err2) => {
        if (err2) console.error('Failed to add repairOrderNumber column to tickets table', err2);
        chooseAndInsert('repairOrderNumber');
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
    // accept 'comments' or 'courtesyComments' from client
    let comments = (typeof req.body.comments !== 'undefined') ? req.body.comments : (req.body.courtesyComments || '');

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
                    });
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
    const size = (typeof body.size !== 'undefined' ? body.size : (typeof body.tireSize !== 'undefined' ? body.tireSize : (typeof body.Size !== 'undefined' ? body.Size : '')));
    const speedRating = (typeof body.speedRating !== 'undefined' ? body.speedRating : (typeof body.speed !== 'undefined' ? body.speed : (typeof body.SpeedRating !== 'undefined' ? body.SpeedRating : '')));
    const LF = (typeof body.LF !== 'undefined' ? body.LF : (typeof body.tireLF !== 'undefined' ? body.tireLF : (typeof body.leftFront !== 'undefined' ? body.leftFront : '')));
    const RF = (typeof body.RF !== 'undefined' ? body.RF : (typeof body.tireRF !== 'undefined' ? body.tireRF : (typeof body.rightFront !== 'undefined' ? body.rightFront : '')));
    const LR = (typeof body.LR !== 'undefined' ? body.LR : (typeof body.tireLR !== 'undefined' ? body.tireLR : (typeof body.leftRear !== 'undefined' ? body.leftRear : '')));
    const RR = (typeof body.RR !== 'undefined' ? body.RR : (typeof body.tireRR !== 'undefined' ? body.tireRR : (typeof body.rightRear !== 'undefined' ? body.rightRear : '')));
    const SP = (typeof body.SP !== 'undefined' ? body.SP : (typeof body.tireSpare !== 'undefined' ? body.tireSpare : (typeof body.spare !== 'undefined' ? body.spare : '')));
    const treadDepth32 = (typeof body.treadDepth32 !== 'undefined' ? body.treadDepth32 : (typeof body.treadDepth !== 'undefined' ? body.treadDepth : (typeof body.tread !== 'undefined' ? body.tread : '')));
    const rotationDue = (typeof body.rotationDue !== 'undefined' ? body.rotationDue : (typeof body.rotationD !== 'undefined' ? body.rotationD : (typeof body.rotation !== 'undefined' ? body.rotation : '')));
    const balance = (typeof body.balanceDue !== 'undefined' ? body.balanceDue : (typeof body.balanace !== 'undefined' ? body.balanace : (typeof body.bal !== 'undefined' ? body.bal : '')));
    const alignment = (typeof body.alignmentCheck !== 'undefined' ? body.alignmentCheck : (typeof body.alignmentC !== 'undefined' ? body.alignmentC : (typeof body.align !== 'undefined' ? body.align : '')));
    const comments = (typeof body.tireComments !== 'undefined' ? body.tireComments : (typeof body.comment !== 'undefined' ? body.comment : null));

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
            db.run(updateSql, params, function (err) {
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
            db.run(insertSql, insertParams, function (err) {
                if (err) {
                    console.error('Failed to save tires info:', err);
                    return res.status(500).json({ error: 'Failed to save tires info' });
                }
                return res.sendStatus(204);
            });
        }
    });
});


router.post('/mechanic/steering-suspension', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    // normalize body / payload
    let body = req.body || {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    // allow JSON payload or form fields
    const ticketId = body.ticketId || body.ticketID || req.query.ticketId || null;
    let items = body.items || null;
    // accept comments from client
    const comments = (typeof body.comments !== 'undefined') ? body.comments : (body.comment || null);

    if (body.payload && !items) {
        try {
            const p = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
            items = p.items || p.rows || null;
        } catch (e) { /* ignore */ }
    }

    // fallback parse sequential form fields item_0,left_0,...
    if (!Array.isArray(items)) {
        const parsed = [];
        for (let i = 0; ; i++) {
            const item = body[`item_${i}`];
            if (typeof item === 'undefined') break;
            parsed.push({
                item: item,
                left: body[`left_${i}`] || '',
                right: body[`right_${i}`] || '',
                front: body[`front_${i}`] || '',
                rear: body[`rear_${i}`] || ''
            });
        }
        if (parsed.length) items = parsed;
    }

    if (!ticketId) return res.status(400).send('ticketId required');
    items = Array.isArray(items) ? items : [];

    db.serialize(() => {
        // find or create parent steeringSuspension row for this ticket
        db.get('SELECT id FROM steeringSuspension WHERE ticketID = ?', [ticketId], (err, row) => {
            if (err) {
                console.error('Find steering parent error:', err);
                return res.status(500).send('DB error');
            }

            const createChildren = (parentId) => {
                // delete existing children
                db.run('DELETE FROM steeringSuspensionTable WHERE steeringSuspensionID = ?', [parentId], (delErr) => {
                    if (delErr) console.warn('Failed to delete old steering children:', delErr);

                    const stmt = db.prepare('INSERT INTO steeringSuspensionTable (steeringSuspensionID, item, left, right, front, rear) VALUES (?, ?, ?, ?, ?, ?)');
                    for (const it of items) {
                        const label = (it.item || it.name || '').toString();
                        const left = (it.left || it.L || it.Left || '').toString();
                        const right = (it.right || it.R || it.Right || '').toString();
                        const front = (it.front || it.Front || '').toString();
                        const rear = (it.rear || it.Rear || '').toString();
                        stmt.run([parentId, label, left, right, front, rear]);
                    }
                    stmt.finalize((finalErr) => {
                        if (finalErr) {
                            console.error('Failed insert steering children:', finalErr);
                            return res.status(500).send('DB insert error');
                        }
                        // update parent comments if provided and column exists (or add it)
                        if (typeof comments !== 'undefined' && comments !== null && comments !== '') {
                            db.all(`PRAGMA table_info('steeringSuspension')`, [], (piErr, cols) => {
                                if (piErr) {
                                    console.warn('PRAGMA error checking steeringSuspension columns', piErr);
                                    return res.sendStatus(204);
                                }
                                const hasComments = Array.isArray(cols) && cols.find(c => String(c.name).toLowerCase() === 'comments');
                                const finalizeResponse = () => res.sendStatus(204);
                                if (!hasComments) {
                                    db.run("ALTER TABLE steeringSuspension ADD COLUMN comments TEXT", [], (altErr) => {
                                        if (altErr) console.warn('Failed to add comments column to steeringSuspension', altErr);
                                        db.run('UPDATE steeringSuspension SET comments = ? WHERE id = ?', [comments, parentId], (upErr) => {
                                            if (upErr) console.warn('Failed to update steering parent comments', upErr);
                                            return finalizeResponse();
                                        });
                                    });
                                } else {
                                    db.run('UPDATE steeringSuspension SET comments = ? WHERE id = ?', [comments, parentId], (upErr) => {
                                        if (upErr) console.warn('Failed to update steering parent comments', upErr);
                                        return finalizeResponse();
                                    });
                                }
                            });
                        } else {
                            return res.sendStatus(204);
                        }
                    });
                });
            };

            if (row && row.id) {
                createChildren(row.id);
            } else {
                // insert parent
                db.run('INSERT INTO steeringSuspension (ticketID, item) VALUES (?, ?)', [ticketId, 'Steering & Suspension'], function (insErr) {
                    if (insErr) {
                        console.error('Failed create steering parent:', insErr);
                        return res.status(500).send('DB insert error');
                    }
                    createChildren(this.lastID);
                });
            }
        });
    });
});

router.post('/mechanic/brakes', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const ticketId = req.body.ticketId || req.body.ticketID || req.query.ticketId || req.query.ticketID;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

    // Accept JSON body: { ticketId, items: [ { item, Spec, actual, status, comments }, ... ] }
    let items = req.body.items;
    if (!items && req.body.payload) {
        try {
            const p = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body.payload;
            items = p.items || p.rows || null;
        } catch (e) { /* ignore */ }
    }
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = null; }
    }

    if (!Array.isArray(items)) {
        // fallback: parse sequential form fields
        const parsed = [];
        for (let i = 0; ; i++) {
            const item = req.body[`item_${i}`];
            if (typeof item === 'undefined') break;
            parsed.push({
                item: item,
                Spec: req.body[`spec_${i}`] || '',
                actual: req.body[`actual_${i}`] || '',
                status: req.body[`status_${i}`] || '',
                comments: req.body[`comments_${i}`] || ''
            });
        }
        items = parsed;
    }

    items = Array.isArray(items) ? items : [];

    // accept parent comments for brakes
    const parentComments = req.body.comments || req.body.brakesComments || req.body.comment || req.body.notes || '';

    // normalize items
    const normalized = items.map(it => ({
        item: (it.item || it.name || it.label || '').toString().trim(),
        Spec: (it.Spec || it.spec || it.Specification || '').toString().trim(),
        actual: (it.actual || it.Actual || it.value || '').toString().trim(),
        status: (it.status || it.State || '').toString().trim(),
        comments: (it.comments || it.note || it.notes || '').toString().trim()
    })).filter(it => it.item);

    // follow parent-child pattern (like steering/courtesy): find or create a parent `brakes` row, then insert children in `brakesTable` referencing that parent by `brakesID`.
    db.serialize(() => {
        // find or create parent brakes row for this ticket
        db.get('SELECT id FROM brakes WHERE ticketID = ?', [ticketId], (err, row) => {
            if (err) {
                console.error('Find brakes parent error:', err);
                return res.status(500).json({ error: 'DB error' });
            }

            const createChildren = (parentId) => {
                // delete existing children for this parent
                db.run('DELETE FROM brakesTable WHERE brakesID = ?', [parentId], (delErr) => {
                    if (delErr) {
                        console.warn('Failed to delete old brakes children:', delErr);
                        // continue to attempt inserts anyway
                    }

                    // helper to update parent comments (adds column if missing)
                    const updateParentCommentsIfNeeded = (cb) => {
                        if (!parentComments || parentComments === '') return cb && cb();
                        db.all(`PRAGMA table_info('brakes')`, [], (piErr, cols) => {
                            if (piErr) {
                                console.warn('PRAGMA error checking brakes columns', piErr);
                                return cb && cb();
                            }
                            const hasComments = Array.isArray(cols) && cols.find(c => String(c.name).toLowerCase() === 'comments');
                            const finalize = () => {
                                if (cb) cb();
                            };
                            if (!hasComments) {
                                db.run("ALTER TABLE brakes ADD COLUMN comments TEXT", [], (altErr) => {
                                    if (altErr) console.warn('Failed to add comments column to brakes', altErr);
                                    db.run('UPDATE brakes SET comments = ? WHERE id = ?', [parentComments, parentId], (upErr) => {
                                        if (upErr) console.warn('Failed to update brakes parent comments', upErr);
                                        return finalize();
                                    });
                                });
                            } else {
                                db.run('UPDATE brakes SET comments = ? WHERE id = ?', [parentComments, parentId], (upErr) => {
                                    if (upErr) console.warn('Failed to update brakes parent comments', upErr);
                                    return finalize();
                                });
                            }
                        });
                    };

                    if (!normalized.length) {
                        // no child rows: still ensure parent comments are saved
                        return updateParentCommentsIfNeeded(() => res.sendStatus(204));
                    }

                    const stmt = db.prepare('INSERT INTO brakesTable (brakesID, item, Spec, actual) VALUES (?, ?, ?, ?)');
                    let pending = normalized.length;
                    let failed = false;
                    normalized.forEach(rowItem => {
                        stmt.run([parentId, rowItem.item, rowItem.Spec, rowItem.actual], (iErr) => {
                            if (failed) return;
                            if (iErr) {
                                failed = true;
                                stmt.finalize(() => {
                                    console.error('Failed to insert brakes row:', iErr);
                                    return res.status(500).json({ error: 'Failed to save brakes rows' });
                                });
                                return;
                            }
                            pending -= 1;
                            if (pending === 0) {
                                stmt.finalize((finErr) => {
                                    if (finErr) {
                                        console.error('Failed finalizing brakes stmt:', finErr);
                                        return res.status(500).json({ error: 'Failed to save brakes rows' });
                                    }
                                    // after inserting children, update parent comments if provided
                                    updateParentCommentsIfNeeded(() => res.sendStatus(204));
                                });
                            }
                        });
                    });
                });
            };

            if (row && row.id) {
                createChildren(row.id);
            } else {
                // create parent brakes row (include provided parentComments)
                db.run('INSERT INTO brakes (ticketID, item, comments) VALUES (?, ?, ?)', [ticketId, 'Brakes (Visual Inspection)', parentComments || ''], function (insErr) {
                    if (insErr) {
                        console.error('Failed create brakes parent:', insErr);
                        return res.status(500).json({ error: 'DB insert error' });
                    }
                    createChildren(this.lastID);
                });
            }
        });
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

//signatures upload route
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

router.post('/ticket-check', (req, res) => {
    const db = req.app && req.app.locals && req.app.locals.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

    const ticketId = req.body.ticketId;
    if (!ticketId) return res.status(400).json({ success: false, message: 'Missing ticketId' });

    const sql = `SELECT id, ticketID, filename, originalName, relativePath, uploadDate
               FROM signatures
               WHERE ticketID = ?
               ORDER BY id DESC
               LIMIT 1`;
    db.get(sql, [ticketId], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.status(404).json({ success: false, message: 'Signature not found' });
        return res.json({ success: true, signature: row });
    });
});

module.exports = router;
