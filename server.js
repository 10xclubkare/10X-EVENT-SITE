/**
 * ============================================================================
 * 10X Event Hub — Express Server
 * ============================================================================
 *
 * A lightweight Node.js + Express backend for the KLU 10X Club Event
 * Management website. Handles:
 *
 *   1. Academic email login verification (@klu.ac.in only)
 *   2. Controller (Admin) login via passcode
 *   3. Event creation and listing (stored in Firestore)
 *   4. Team registration with Firestore persistence
 *   5. Dynamic QR code generation for digital event passes
 *
 * ============================================================================
 */

const express = require('express');
const ExcelJS = require('exceljs');
const QRCode  = require('qrcode');
const path    = require('path');
const admin   = require('firebase-admin');

// Load .env if present
try { require('dotenv').config(); } catch (_) {}

// ---------------------------------------------------------------------------
// App Initialisation
// ---------------------------------------------------------------------------

const app  = express();
const PORT = process.env.PORT || 3000;

// Hardcoded Admin Passcode for /controller
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'b10xCLUB';

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (err) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT', err);
    admin.initializeApp();
  }
} else {
  // Fallback for local testing if GOOGLE_APPLICATION_CREDENTIALS is set, or default
  admin.initializeApp();
}

const db = admin.firestore();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/login
 * Validates that the submitted email belongs to the @klu.ac.in domain.
 */
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }
  if (email.toLowerCase().trim().endsWith('@klu.ac.in')) {
    return res.json({ success: true });
  }
  return res.status(403).json({ success: false, message: 'Only @klu.ac.in academic emails are allowed.' });
});

/**
 * POST /api/controller/login
 * Validates the admin passcode. In a real app, use sessions/JWT.
 */
app.post('/api/controller/login', (req, res) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    // Return a dummy token for frontend routing
    return res.json({ success: true, token: 'controller-access-token-777' });
  }
  return res.status(401).json({ success: false, message: 'Invalid controller passcode.' });
});

/**
 * GET /api/events
 * Returns the list of active events from Firestore.
 */
app.get('/api/events', async (req, res) => {
  try {
    const snapshot = await db.collection('events').get();
    const events = [];
    snapshot.forEach(doc => {
      events.push(doc.data());
    });
    res.json({ events });
  } catch (err) {
    console.error('[ERROR] Failed to fetch events from Firestore:', err);
    res.status(500).json({ success: false, message: 'Failed to load events.' });
  }
});

/**
 * POST /api/events
 * Admin endpoint to create a new event in Firestore.
 */
app.post('/api/events', async (req, res) => {
  // Check dummy auth token
  if (req.headers.authorization !== 'Bearer controller-access-token-777') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const { title, date, fee, max } = req.body;
  if (!title || !date || !fee || !max) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const newEvent = {
      id: 'EVT' + Date.now(),
      title,
      date,
      fee,
      max
    };
    
    // Write to Firestore
    await db.collection('events').doc(newEvent.id).set(newEvent);
    
    res.json({ success: true, event: newEvent });
  } catch (err) {
    console.error('[ERROR] Failed to save event to Firestore:', err);
    res.status(500).json({ success: false, message: 'Server error saving event.' });
  }
});

/**
 * POST /api/register
 * Registers a team, saves to Firestore, generates QR.
 */
app.post('/api/register', async (req, res) => {
  const { eventId, teamName, members, txnId } = req.body;

  if (!teamName || !members || !members[0] || !members[1] || !txnId) {
    return res.status(400).json({
      success: false,
      message: 'Team Name, Member 1, Member 2, and TxnID are required.'
    });
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Write to Firestore
    // ------------------------------------------------------------------
    const registrationData = {
      eventId: eventId || 'UNKNOWN',
      teamName: teamName,
      txnId: txnId,
      timestamp: new Date().toISOString()
    };
    
    // Dynamically add members 1-5
    for(let i=0; i<5; i++) {
      const m = members[i];
      if (m) {
        registrationData[`m${i+1}_name`] = m.name;
        registrationData[`m${i+1}_reg`] = m.reg;
        registrationData[`m${i+1}_phone`] = m.phone;
        registrationData[`m${i+1}_sec`] = m.sec;
        registrationData[`m${i+1}_dept`] = m.dept;
        registrationData[`m${i+1}_res`] = m.res;
      }
    }

    const docRef = await db.collection('registrations').add(registrationData);
    console.log(`[REGISTER] Team ${teamName} saved to Firestore with ID: ${docRef.id}`);

    // ------------------------------------------------------------------
    // Step 2: Generate Ticket QR Code
    // ------------------------------------------------------------------
    const ticketPayload = JSON.stringify({
      teamName,
      leaderName: members[0].name,
      leaderPhone: members[0].phone,
      memberCount: members.length,
      eventId,
      txnId,
      valid: true
    });

    const qrCodeUrl = await QRCode.toDataURL(ticketPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#1d1d1f', light: '#ffffff' }
    });

    res.json({ success: true, qrCodeUrl });

  } catch (err) {
    console.error('[ERROR] Registration failed:', err);
    res.status(500).json({ success: false, message: 'Server error while saving registration.' });
  }
});

/**
 * GET /api/registrations/download
 * Downloads the master Excel sheet dynamically generated from Firestore.
 */
app.get('/api/registrations/download', async (req, res) => {
  try {
    const snapshot = await db.collection('registrations').orderBy('timestamp', 'desc').get();
    
    if (snapshot.empty) {
      return res.status(404).send('No registrations found yet.');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Registrations');
    
    sheet.columns = [
      { header: 'Event ID',      key: 'eventId',   width: 15 },
      { header: 'Team Name',     key: 'teamName',  width: 25 },
      { header: 'Txn ID',        key: 'txnId',     width: 20 },
      // Member 1
      { header: 'M1 Name',       key: 'm1_name',   width: 20 },
      { header: 'M1 RegNo',      key: 'm1_reg',    width: 15 },
      { header: 'M1 Phone',      key: 'm1_phone',  width: 15 },
      { header: 'M1 Sec',        key: 'm1_sec',    width: 10 },
      { header: 'M1 Dept',       key: 'm1_dept',   width: 15 },
      { header: 'M1 Res',        key: 'm1_res',    width: 15 },
      // Member 2
      { header: 'M2 Name',       key: 'm2_name',   width: 20 },
      { header: 'M2 RegNo',      key: 'm2_reg',    width: 15 },
      { header: 'M2 Phone',      key: 'm2_phone',  width: 15 },
      { header: 'M2 Sec',        key: 'm2_sec',    width: 10 },
      { header: 'M2 Dept',       key: 'm2_dept',   width: 15 },
      { header: 'M2 Res',        key: 'm2_res',    width: 15 },
      // Member 3
      { header: 'M3 Name',       key: 'm3_name',   width: 20 },
      { header: 'M3 RegNo',      key: 'm3_reg',    width: 15 },
      { header: 'M3 Phone',      key: 'm3_phone',  width: 15 },
      { header: 'M3 Sec',        key: 'm3_sec',    width: 10 },
      { header: 'M3 Dept',       key: 'm3_dept',   width: 15 },
      { header: 'M3 Res',        key: 'm3_res',    width: 15 },
      // Member 4
      { header: 'M4 Name',       key: 'm4_name',   width: 20 },
      { header: 'M4 RegNo',      key: 'm4_reg',    width: 15 },
      { header: 'M4 Phone',      key: 'm4_phone',  width: 15 },
      { header: 'M4 Sec',        key: 'm4_sec',    width: 10 },
      { header: 'M4 Dept',       key: 'm4_dept',   width: 15 },
      { header: 'M4 Res',        key: 'm4_res',    width: 15 },
      // Member 5
      { header: 'M5 Name',       key: 'm5_name',   width: 20 },
      { header: 'M5 RegNo',      key: 'm5_reg',    width: 15 },
      { header: 'M5 Phone',      key: 'm5_phone',  width: 15 },
      { header: 'M5 Sec',        key: 'm5_sec',    width: 10 },
      { header: 'M5 Dept',       key: 'm5_dept',   width: 15 },
      { header: 'M5 Res',        key: 'm5_res',    width: 15 },
      
      { header: 'Timestamp',     key: 'timestamp', width: 25 }
    ];
    sheet.getRow(1).font = { bold: true };

    snapshot.forEach(doc => {
      sheet.addRow(doc.data());
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'registrations_master.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[ERROR] Failed to download registrations from Firestore:', err);
    res.status(500).send('Server error while generating Excel file.');
  }
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║       10X Event Hub — Server Ready       ║');
    console.log(`  ║    http://localhost:${PORT}                  ║`);
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
  });
}

module.exports = app;