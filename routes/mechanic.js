const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const e = require('express');

const videoDir = path.join(__dirname, '..', 'upload', 'videos');
const imageDir = path.join(__dirname, '..', 'upload', 'images');
const signatureDir = path.join(__dirname, '..', 'upload', 'signatures');
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(signatureDir, { recursive: true });

// save signature dataURL to signatures table (write file, insert DB row)
async function saveSignatureFromDataUrl(db, dataUrl, clientName, ticketId = null) {
    return new Promise((resolve, reject) => {
        if (!dataUrl || typeof dataUrl !== 'string') return resolve(null);
        const comma = dataUrl.indexOf(',');
        if (comma === -1) return resolve(null);
        const b64 = dataUrl.slice(comma + 1);
        let buffer;
        try { buffer = Buffer.from(b64, 'base64'); } catch (e) { return resolve(null); }

        const filename = `signature-${Date.now()}.png`;
        const savePath = path.join(signatureDir, filename);
        fs.writeFile(savePath, buffer, (writeErr) => {
            if (writeErr) return reject(writeErr);

            const relPath = path.relative(path.join(__dirname, '..'), savePath).split(path.sep).join('/');

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

                const insertSql = `INSERT INTO signatures (ticketID, filename, originalName, relativePath, uploadDate) VALUES (?, ?, ?, ?, datetime('now'))`;
                db.run(insertSql, [ticketId, filename, clientName || filename, relPath], function (insertErr) {
                    if (insertErr) {
                        // cleanup file if DB insert fails
                        try { fs.unlinkSync(savePath); } catch (e) { /* ignore */ }
                        return reject(insertErr);
                    }
                    return resolve({ id: this.lastID, filename, relativePath: relPath });
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

// signature storage 
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

                                    // load emissions child rows joined to their parent (emissions) so client can populate the visual table
                                    const emissionsJoinSql = `
                                                                        SELECT et.*, e.ticketID AS emissionsTicketID, e.comments AS emissionsComments, e.obd AS emissionsOBD, e.inspections AS emissionsInspections, e.emissionsDue AS emissionsDue, e.nextOilChange AS emissionsNextOilChange, e.inspectedBy AS emissionsInspectedBy, e.reInspectedBy AS emissionsReInspectedBy
                                                                        FROM emissionsTable et
                                                                        INNER JOIN emissions e ON et.emissionsID = e.id
                                                                        WHERE e.ticketID = ?
                                                                        ORDER BY et.id ASC
                                                                    `;

                                    db.all(emissionsJoinSql, [ticketId], (emErr, emissionsRows) => {
                                        if (emErr) {
                                            console.error('Error loading emissions joined rows:', emErr);
                                        } else {
                                            ticket.sections = ticket.sections || {};
                                            ticket.sections.emissionsTable = emissionsRows || [];
                                        }

                                        // also fetch the emissions parent row (contains ticket-level fields and comments)
                                        db.get('SELECT * FROM emissions WHERE ticketID = ?', [ticketId], (epErr, emissionsParent) => {
                                            if (epErr) {
                                                console.error('Error fetching emissions parent:', epErr);
                                            }
                                            ticket.sections = ticket.sections || {};
                                            ticket.sections.emissions = emissionsParent || null;

                                            // fetch warnings linked to this emissions parent (if any)
                                            if (emissionsParent && emissionsParent.id) {
                                                db.all('SELECT * FROM warningsTable WHERE emissionsID = ?', [emissionsParent.id], (wErr, warnRows) => {
                                                    if (wErr) console.error('Error loading emissions warnings:', wErr);
                                                    ticket.sections.emissionsWarnings = warnRows || [];
                                                    return res.render('mechanic', { ticket, editMode: explicitEdit });
                                                });
                                            } else {
                                                ticket.sections.emissionsWarnings = [];
                                                return res.render('mechanic', { ticket, editMode: explicitEdit });
                                            }
                                        });
                                    });
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
    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    // normalize body
    const body = (typeof req.body === 'string') ? (() => { try { return JSON.parse(req.body); } catch(e){ return {}; } })() : (req.body || {});

    const roNum = (body.roNum || body.repairOrderNumber || '').toString().trim();
    const roDate = body.roDate || body.date || '';
    const technician = body.technician || body.techName || '';
    const timeArrive = body.timeIn || '';
    const timeOut = body.timeOut || '';
    const totTime = body.totTime || body.totalTime || '';
    const custName = body.custName || body.customerName || '';
    const custAdd = body.custAddress || body.customerAddress || '';
    const custPhone = body.custPhone || body.customerPhone || '';
    const custEmail = body.custEmail || body.customerEmail || '';
    const concern = body.concern || '';
    const diagnosis = body.diagnosis || '';
    const sDate = body.sDate || body.dateSigned || '';
    const ticketStatus = body.ticketStatus || body.stat || 'open';
    const incomingTicketId = body.ticketId || body.ticketID || body.id || req.query.id || req.query.ticketId || null;
    // debug: log incoming payload shape so we can see why recommended repairs aren't present
    try {
        console.log('POST /mechanic payload keys:', Object.keys(body || {}));
        console.log('POST /mechanic preview body:', JSON.stringify(body || {}, null, 0).slice(0, 2000));
    } catch (e) {
        console.log('POST /mechanic body (inspect failed):', body);
    }
    console.log('incomingTicketId:', incomingTicketId);

    if (!roNum) {
        return res.status(400).send('Repair Order number (roNum) is required');
    }

    // parse repairs array from several possible field names (handles JSON string or object from multipart)
    let repairs = [];
    const repairsCandidates = [body.repairs, body['repairs[]'], body.recommendedRepairs, body.recommendedRepairsText, body.repairsJson, body.recRepairs, body.repairLines];
    for (const cand of repairsCandidates) {
        if (!cand) continue;
        if (Array.isArray(cand)) { repairs = cand; break; }
        if (typeof cand === 'string') {
            // ignore empty strings
            if (cand.trim() === '') continue;
            try {
                const parsed = JSON.parse(cand);
                if (Array.isArray(parsed)) { repairs = parsed; break; }
            } catch (e) {
                // not JSON — if this is a single-line description, try to wrap it
                // but prefer other sources
            }
        }
    }

    // debug: log what we found for repairs
    try { console.log('Parsed repairs count:', Array.isArray(repairs) ? repairs.length : 0); } catch (e) { /* ignore */ }

    // If nothing found, try to reconstruct from repeated form fields or indexed fields:
    if (!Array.isArray(repairs) || repairs.length === 0) {
        // case: fields submitted as arrays: repairDescription[], qty[], partNumber[], ...
        const descArray = body['repairDescription[]'] || body.repairDescription || body['repair_description[]'] || null;
        if (Array.isArray(descArray)) {
            const len = descArray.length;
            const built = [];
            for (let i = 0; i < len; i++) {
                const desc = descArray[i];
                if (!desc || String(desc).trim() === '') continue;
                built.push({
                    repairDescription: String(desc),
                    qty: (Array.isArray(body.qty) && body.qty[i]) || body[`qty[${i}]`] || body[`qty_${i}`] || 0,
                    partNumber: (Array.isArray(body.partNumber) && body.partNumber[i]) || body[`partNumber[${i}]`] || body[`partNumber_${i}`] || '',
                    partPrice: (Array.isArray(body.partPrice) && body.partPrice[i]) || body[`partPrice[${i}]`] || body[`partPrice_${i}`] || 0,
                    partsTotal: (Array.isArray(body.partsTotal) && body.partsTotal[i]) || body[`partsTotal[${i}]`] || body[`partsTotal_${i}`] || 0,
                    laborHours: (Array.isArray(body.laborHours) && body.laborHours[i]) || body[`laborHours[${i}]`] || body[`laborHours_${i}`] || 0,
                    laborTotal: (Array.isArray(body.laborTotal) && body.laborTotal[i]) || body[`laborTotal[${i}]`] || body[`laborTotal_${i}`] || 0
                });
            }
            if (built.length) repairs = built;
        } else {
            // fallback: find indexed suffix keys like repairDescription_0, qty_0, etc.
            const indices = new Set();
            Object.keys(body || {}).forEach(k => {
                const m = k.match(/_(\d+)$/);
                if (m) indices.add(Number(m[1]));
                const m2 = k.match(/repairs\[(\d+)\]\[(\w+)\]/);
                if (m2) indices.add(Number(m2[1]));
            });
            if (indices.size > 0) {
                const built = [];
                const idxs = Array.from(indices).sort((a,b)=>a-b);
                for (const i of idxs) {
                    const desc = body[`repairDescription_${i}`] || body[`repairDescription[${i}]`] || body[`repairs[${i}][repairDescription]`] || body[`repairs[${i}][description]`] || null;
                    if (!desc || String(desc).trim() === '') continue;
                    built.push({
                        repairDescription: String(desc),
                        qty: body[`qty_${i}`] || body[`qty[${i}]`] || 0,
                        partNumber: body[`partNumber_${i}`] || body[`partNumber[${i}]`] || '',
                        partPrice: body[`partPrice_${i}`] || body[`partPrice[${i}]`] || 0,
                        partsTotal: body[`partsTotal_${i}`] || body[`partsTotal[${i}]`] || 0,
                        laborHours: body[`laborHours_${i}`] || body[`laborHours[${i}]`] || 0,
                        laborTotal: body[`laborTotal_${i}`] || body[`laborTotal[${i}]`] || 0
                    });
                }
                if (built.length) repairs = built;
            }
        }
    }
    // ensure repairs is an array
    if (!Array.isArray(repairs)) repairs = [];
    const recommendedRepairsText = JSON.stringify(repairs);

    // Determine whether the client actually submitted repair lines (vs leaving the repairs out)
    let repairsProvided = false;
    // If we parsed any repairs, that's a clear sign
    if (Array.isArray(repairs) && repairs.length > 0) repairsProvided = true;
    // Otherwise check if the request body contains any repair-related fields (arrays or indexed names)
    const bodyKeys = Object.keys(body || {});
    const repairKeyNames = ['repairs', 'repairs[]', 'repairDescription[]', 'repairDescription', 'qty[]', 'partNumber[]', 'partPrice[]', 'partsTotal[]', 'laborHours[]', 'laborTotal[]'];
    if (!repairsProvided) {
        for (const k of repairKeyNames) {
            if (Object.prototype.hasOwnProperty.call(body, k)) {
                const v = body[k];
                if (Array.isArray(v) && v.length >= 0) { repairsProvided = v.length > 0; break; }
                if (typeof v === 'string') { if (v.trim() !== '') { repairsProvided = true; break; } /* empty string treated as not provided */ }
                // any non-empty non-string value counts as provided
                if (v != null && typeof v !== 'string') { repairsProvided = true; break; }
            }
        }
    }
    // Also detect indexed keys like repairDescription_0, qty_0, repairs[0][repairDescription]
    if (!repairsProvided) {
        for (const k of bodyKeys) {
            if (/repairDescription_(\d+)$/.test(k) || /qty_(\d+)$/.test(k) || /partPrice_(\d+)$/.test(k) || /repairs\[\d+\]\[/.test(k)) { repairsProvided = true; break; }
        }
    }

    const saveRecRepairs = (ticketId, repairsArr, cb) => {
        // Always remove existing recRepairs for this ticket first so updates that remove lines clear DB
        db.run('DELETE FROM recRepairs WHERE ticketId = ?', [ticketId], (delErr) => {
            if (delErr) console.warn('Failed to delete old recRepairs for ticket', ticketId, delErr);

            // If no repairs provided, we're done after deletion
            if (!Array.isArray(repairsArr) || repairsArr.length === 0) {
                return cb && cb(null);
            }

            const insertRecSql = `INSERT INTO recRepairs (ticketId, repairDescription, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const stmt = db.prepare(insertRecSql);
            let pending = repairsArr.length;
            let failed = false;

            repairsArr.forEach((r) => {
                // normalize fields from UI to DB columns
                const desc = (r.repairDescription || r.description || r.desc || r.name || '').toString();
                const qty = Number.isFinite(Number(r.qty)) ? parseInt(r.qty) : (r.qty ? parseInt(r.qty) : 0);
                const partNumber = (r.partNumber || r.partNum || r.pn || '').toString();
                const partPrice = Number.isFinite(Number(r.partPrice)) ? parseFloat(r.partPrice) : (r.partPrice ? parseFloat(r.partPrice) : 0);
                const partsTotal = Number.isFinite(Number(r.partsTotal)) ? parseFloat(r.partsTotal) : (r.partsTotal ? parseFloat(r.partsTotal) : (qty * partPrice));
                const laborHours = Number.isFinite(Number(r.laborHours)) ? parseFloat(r.laborHours) : (r.laborHours ? parseFloat(r.laborHours) : 0);
                const laborTotal = Number.isFinite(Number(r.laborTotal)) ? parseFloat(r.laborTotal) : (r.laborTotal ? parseFloat(r.laborTotal) : (laborHours * 100));

                stmt.run([ticketId, desc, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal], (iErr) => {
                    if (failed) return;
                    if (iErr) {
                        failed = true;
                        stmt.finalize(() => cb && cb(iErr));
                        return;
                    }
                    pending -= 1;
                    if (pending === 0) {
                        stmt.finalize((finErr) => cb && cb(finErr || null));
                    }
                });
            });
        });
    };

    // finalize save actions: save recRepairs (if provided) then save signature (if provided), then redirect
    const finalizeSave = (targetId) => {
        const afterRepairs = () => {
            if (body.signature && typeof body.signature === 'string' && body.signature.trim() !== '') {
                saveSignatureFromDataUrl(db, body.signature, custName, targetId)
                    .then(() => res.redirect('/mechanic?id=' + targetId))
                    .catch((sigErr) => {
                        console.error('Failed to save signature for ticket', targetId, sigErr);
                        // still redirect even if signature save fails
                        return res.redirect('/mechanic?id=' + targetId);
                    });
            } else {
                return res.redirect('/mechanic?id=' + targetId);
            }
        };

        if (repairsProvided) {
            saveRecRepairs(targetId, repairs, (rErr) => {
                if (rErr) { console.error('Failed saving recRepairs on save:', rErr); return res.status(500).send('Failed to save repairs'); }
                return afterRepairs();
            });
        } else {
            return afterRepairs();
        }
    };

    // Helper: perform update for existing ticket id
    const performUpdate = (targetId) => {
        const updateSql = `UPDATE tickets SET repairOrderNumber = ?, date = ?, techName = ?, timeIn = ?, timeOut = ?, totalTime = ?, customerName = ?, customerAddress = ?, customerPhone = ?, customerEmail = ?, concern = ?, diagnosis = ?, recommendedRepairs = ?, dateSigned = ?, stat = ? WHERE id = ?`;
        const params = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus, targetId];
        db.run(updateSql, params, function(updErr) {
            if (updErr) {
                console.error('Failed to update ticket:', updErr);
                return res.status(500).send('Failed to update ticket: ' + (updErr.message || updErr));
            }
            // perform child saves (repairs + signature) then redirect
            return finalizeSave(targetId);
        });
    };

    // Creating new ticket: first check for duplicate repairOrderNumber
    const tryInsertNew = () => {
        const checkSql = `SELECT id FROM tickets WHERE repairOrderNumber = ? LIMIT 1`;
        db.get(checkSql, [roNum], (chkErr, existing) => {
            if (chkErr) {
                console.error('Failed checking existing RO:', chkErr);
                return res.status(500).send('DB error');
            }
            if (existing) {
                // duplicate exists and this is a new-ticket attempt -> inform user and stop
                console.log(incomingTicketId)
                return res.status(409).send('<script>alert("The RONum already exist"); window.history.back();</script>');
            }

            const insertSql = `INSERT INTO tickets (repairOrderNumber, date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned, stat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [roNum, roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate, ticketStatus];
            db.run(insertSql, params, function(insErr) {
                if (insErr) {
                    console.error('Failed to insert new ticket:', insErr);
                    return res.status(500).send('Failed to create ticket: ' + (insErr.message || insErr));
                }
                const newId = this.lastID;
                // finalize repairs/signature save and redirect
                return finalizeSave(newId);
            });
        });
    };

    // Main flow: if incomingTicketId present -> update existing ticket (ensure it exists first)
    if (incomingTicketId) {
        db.get('SELECT id FROM tickets WHERE id = ?', [incomingTicketId], (gErr, row) => {
            if (gErr) {
                console.error('DB error fetching ticket for update:', gErr);
                return res.status(500).send('DB error');
            }
            if (!row) {
                return res.status(404).send('Ticket to update not found');
            }
            // If roNum collides with another ticket (different id), block the change
            db.get('SELECT id FROM tickets WHERE repairOrderNumber = ? LIMIT 1', [roNum], (chkErr, found) => {
                if (chkErr) {
                    console.error('Failed checking RO on update:', chkErr);
                    return res.status(500).send('DB error');
                }
                if (found && found.id !== Number(incomingTicketId)) {
                    return res.status(409).send('<script>alert("The RONum already exist"); window.history.back();</script>');
                }
                return performUpdate(incomingTicketId);
            });
        });
    } else {
        tryInsertNew();
    }

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

router.post('/mechanic/emissions', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });

    // normalize body (accept JSON or form fields)
    let body = req.body || {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const ticketId = body.ticketId || body.ticketID || req.query.ticketId || req.query.ticketID;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

    // items for emissions table (visual items)
    let items = body.items || body.rows || body.table || null;
    if (!items && body.payload) {
        try { const p = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload; items = p.items || p.rows || null; } catch (e) { }
    }
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = null; }
    }

    // middle emissions info
    const emissionsInfo = body.emissions || body.data || {};
    // also accept individual fields
    const OBD = emissionsInfo.OBD || body.OBD || body.obd || '';
    const inspections = emissionsInfo.inspections || body.inspections || '';
    const emissionsDue = emissionsInfo.emissionsDue || body.emissionsDue || body.emissions_due || '';
    const nextOilChange = emissionsInfo.nextOilChange || body.nextOilChange || body.next_oil_change || '';
    const inspectedBy = emissionsInfo.inspectedBy || body.inspectedBy || body.inspected_by || '';
    const reInspectedBy = emissionsInfo.reInspectedBy || body.reInspectedBy || body.re_inspected_by || '';
    const warningsText = emissionsInfo.warnings || body.warningsText || body.warnings || '';
    // ensure comments always defined and add debug logging to inspect incoming payload
    const comments = emissionsInfo.comments || body.comments || body.emissionsComments || '';
    try { console.log('POST /mechanic/emissions - raw body keys:', Object.keys(body)); } catch (e) { }
    try { console.log('POST /mechanic/emissions - body snapshot:', JSON.stringify(body)); } catch (e) { }
    console.log('Received emissions info:', { OBD, inspections, emissionsDue, nextOilChange, inspectedBy, reInspectedBy, warningsText, comments });
    // tags/warnings array
    let tags = body.tags || body.warnings || emissionsInfo.tags || emissionsInfo.warnings || null;
    if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(s => s.trim()).filter(Boolean); }
    }
    tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);

    items = Array.isArray(items) ? items : (items ? [items] : []);

    // normalize items rows
    const normalizedItems = items.map(it => ({
        item: (it.item || it.name || it.label || '').toString().trim(),
        status: (it.status || it.State || it.state || '').toString().trim(),
        notes: (it.notes || it.note || '').toString().trim()
    })).filter(it => it.item);

    db.serialize(() => {
        // ensure emissionsTable has emissionsID column and warningsTable has emissionsID column (for parent-child link)
        db.all("PRAGMA table_info('emissionsTable')", [], (piErr, cols) => {
            if (piErr) console.warn('PRAGMA emissionsTable failed', piErr);
            const hasEmissionsID = Array.isArray(cols) && cols.find(c => String(c.name).toLowerCase() === 'emissionsid');
            const ensureEmissionsID = (cb) => {
                if (hasEmissionsID) return cb && cb();
                db.run("ALTER TABLE emissionsTable ADD COLUMN emissionsID INTEGER", [], (altErr) => { if (altErr) console.warn('Failed add emissionsID to emissionsTable', altErr); return cb && cb(); });
            };

            db.all("PRAGMA table_info('warningsTable')", [], (pwErr, wcols) => {
                if (pwErr) console.warn('PRAGMA warningsTable failed', pwErr);
                const hasWarnEmissionsID = Array.isArray(wcols) && wcols.find(c => String(c.name).toLowerCase() === 'emissionsid');
                const ensureWarningsEmissionsID = (cb) => {
                    if (hasWarnEmissionsID) return cb && cb();
                    db.run("ALTER TABLE warningsTable ADD COLUMN emissionsID INTEGER", [], (altErr) => { if (altErr) console.warn('Failed add emissionsID to warningsTable', altErr); return cb && cb(); });
                };

                ensureEmissionsID(() => ensureWarningsEmissionsID(() => {
                    // find or create parent emissions row
                    db.get('SELECT id FROM emissions WHERE ticketID = ?', [ticketId], (gErr, prow) => {
                        if (gErr) { console.error('Find emissions parent error', gErr); return res.status(500).json({ error: 'DB error' }); }

                        // helper: update parent emissions fields only for columns that exist
                        const updateParentFields = (parentId, cb) => {
                            db.all("PRAGMA table_info('emissions')", [], (piErr, cols) => {
                                if (piErr) { console.warn('PRAGMA emissions check failed', piErr); if (cb) cb(); return; }
                                const existing = Array.isArray(cols) ? cols.map(c => String(c.name).toLowerCase()) : [];
                                const parts = [];
                                const params = [];
                                const mapping = {
                                    obd: OBD,
                                    inspections: inspections,
                                    emissionsdue: emissionsDue,
                                    nextoilchange: nextOilChange,
                                    inspectedby: inspectedBy,
                                    reinspectedby: reInspectedBy,
                                    warnings: warningsText,
                                    comments: comments
                                };
                                Object.keys(mapping).forEach(k => {
                                    if (existing.includes(k)) {
                                        parts.push(k + ' = ?');
                                        params.push(mapping[k] || '');
                                    }
                                });
                                if (!parts.length) { if (cb) cb(); return; }
                                const sql = `UPDATE emissions SET ${parts.join(', ')} WHERE id = ?`;
                                params.push(parentId);
                                db.run(sql, params, (uErr) => {
                                    if (uErr) console.warn('Failed update emissions parent (dynamic)', uErr);
                                    if (cb) cb();
                                });
                            });
                        };

                        // helper: create parent emissions row using actual table columns
                        const createParentRow = (cb) => {
                            db.all("PRAGMA table_info('emissions')", [], (piErr, cols) => {
                                if (piErr) { console.warn('PRAGMA emissions failed', piErr); return cb(piErr); }
                                const colInfos = Array.isArray(cols) ? cols.filter(c => c && c.name && c.name.toLowerCase() !== 'id') : [];
                                const colNames = colInfos.map(c => c.name);
                                if (!colNames.length) return cb(new Error('No columns found for emissions'));
                                const values = colNames.map((cn, idx) => {
                                    const lower = cn.toLowerCase();
                                    if (lower === 'ticketid' || lower === 'ticket_id') return ticketId;
                                    if (lower === 'obd') return OBD || '';
                                    if (lower === 'inspections') return inspections || '';
                                    if (lower === 'emissionsdue') return emissionsDue || '';
                                    if (lower === 'nextoilchange') return nextOilChange || '';
                                    if (lower === 'inspectedby') return inspectedBy || '';
                                    if (lower === 'reinspectedby') return reInspectedBy || '';
                                    if (lower === 'warnings') return warningsText || '';
                                    if (lower === 'comments') return comments || '';
                                    // default for other columns: empty string if NOT NULL, otherwise null
                                    try { const info = colInfos[idx]; return (info && info.notnull) ? '' : null; } catch (e) { return null; }
                                });
                                const placeholders = colNames.map(() => '?').join(', ');
                                const sql = `INSERT INTO emissions (${colNames.join(', ')}) VALUES (${placeholders})`;
                                db.run(sql, values, function (insErr) {
                                    if (insErr) return cb(insErr);
                                    return cb(null, this.lastID);
                                });
                            });
                        };

                        const upsertParent = (parentId, created) => {
                            // delete existing child rows linked to this parent
                            db.run('DELETE FROM emissionsTable WHERE emissionsID = ?', [parentId], (delErr) => {
                                if (delErr) console.warn('Failed to delete old emissionsTable rows', delErr);

                                // ensure the parent comments are saved immediately so they persist even if child/warning processing errors occur
                                db.run('UPDATE emissions SET comments = ? WHERE id = ?', [comments || '', parentId], (cErr) => {
                                    if (cErr) console.warn('Failed to explicitly update emissions comments', cErr);

                                    // insert new child rows
                                    if (!normalizedItems.length) {
                                        // still update parent fields and warnings
                                        const finalize = () => saveWarnings(parentId);
                                        if (created) return finalize();
                                        // update parent dynamically according to existing columns
                                        return updateParentFields(parentId, finalize);
                                    }

                                    const stmt = db.prepare('INSERT INTO emissionsTable (emissionsID, item, status, notes) VALUES (?, ?, ?, ?)');
                                    let pending = normalizedItems.length; let failed = false;
                                    normalizedItems.forEach(row => {
                                        stmt.run([parentId, row.item, row.status, row.notes], (itemErr) => {
                                            if (failed) return;
                                            if (itemErr) { failed = true; stmt.finalize(() => { console.error('Failed insert emissionsTable row', itemErr); return res.status(500).json({ error: 'Failed to save emissions table rows' }); }); return; }
                                            pending -= 1;
                                            if (pending === 0) {
                                                stmt.finalize((finErr) => {
                                                    if (finErr) { console.error('Failed finalize emissionsTable stmt', finErr); return res.status(500).json({ error: 'Failed to save emissions table rows' }); }
                                                    // update parent fields now (use dynamic updater)
                                                    updateParentFields(parentId, () => saveWarnings(parentId));
                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        };

                        const saveWarnings = (parentId) => {
                            // always update the emissions parent comments first (ensure comments persist even when no tags)
                            db.run('UPDATE emissions SET comments = ? WHERE id = ?', [comments || '', parentId], (cErr) => {
                                if (cErr) console.warn('Failed to update emissions comments explicitly', cErr);
                                // remove existing warnings linked to this parent
                                db.run('DELETE FROM warningsTable WHERE emissionsID = ?', [parentId], (wdelErr) => {
                                    if (wdelErr) console.warn('Failed to delete old warnings', wdelErr);
                                    if (!tags || tags.length === 0) return res.sendStatus(204);
                                    const wstmt = db.prepare('INSERT INTO warningsTable (emissionsID, item) VALUES (?, ?)');
                                    let wpending = tags.length; let wfailed = false;
                                    tags.forEach(t => {
                                        wstmt.run([parentId, (t || '').toString()], (we) => {
                                            if (wfailed) return;
                                            if (we) { wfailed = true; wstmt.finalize(() => { console.error('Failed insert warning', we); return res.status(500).json({ error: 'Failed to save warnings' }); }); return; }
                                            wpending -= 1;
                                            if (wpending === 0) { wstmt.finalize((wfin) => { if (wfin) { console.error('Failed finalize warnings stmt', wfin); return res.status(500).json({ error: 'Failed to save warnings' }); } return res.sendStatus(204); }); }
                                        });
                                    });
                                });
                            });
                        };

                        if (prow && prow.id) {
                            upsertParent(prow.id, false);
                        } else {
                            // create parent emissions row using dynamic insert (handles schema differences)
                            createParentRow((cErr, newId) => {
                                if (cErr) { console.error('Failed create emissions parent', cErr); return res.status(500).json({ error: 'DB insert error' }); }
                                upsertParent(newId, true);
                            });
                        }
                    });
                }));
            });
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

    // accept several common field names from the client (ticketID, ticketId, id)
    const ticketIdValue = (req.body && (req.body.ticketID || req.body.ticketId || req.body.id)) || null;
    const insertSql = `INSERT INTO videos (ticketID, filename, originalName, relativePath, mimeType, sizeBytes, uploadDate)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
    const params = [ticketIdValue, file.filename, file.originalname, relativePath, file.mimetype, file.size];

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
        // accept several common field names from the client (ticketID, ticketId, id)
        // fallback to query params and Referer URL (if present)
        const ticketIdValue = (req.body && (req.body.ticketID || req.body.ticketId || req.body.id))
            || (req.query && (req.query.ticketID || req.query.ticketId || req.query.id))
            || (() => {
                const ref = req.get('referer') || req.get('referrer') || '';
                try {
                    const u = new URL(ref);
                    return u.searchParams.get('id') || u.searchParams.get('ticketId') || u.searchParams.get('ticketID') || null;
                } catch (e) {
                    return null;
                }
            })() || null;
         const insertSql = `INSERT INTO pictures (ticketID, filename, originalName, relativePath, mimeType, sizeBytes, uploadDate)
                      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
         const params = [ticketIdValue, file.filename, file.originalname, relativePath, file.mimetype, file.size];

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