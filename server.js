/**
 * ============================================================================
 * 10X Event Hub — Express Server
 * ============================================================================
 *
 * A lightweight Node.js + Express backend for the KLU 10X Club Event
 * Management website. Handles:
 *
 *   1. Academic email login verification (@klu.ac.in only)
 *   2. Event registration with Excel persistence
 *   3. Dynamic QR code generation for digital event passes
 *
 * DEPENDENCIES:
 *   - express   : HTTP server framework
 *   - exceljs   : Read/write .xlsx files for registration records
 *   - qrcode    : Generate QR code data URLs from JSON payloads
 *
 * USAGE:
 *   $ npm install
 *   $ node server.js
 *   → Server runs at http://localhost:3000
 *
 * ============================================================================
 */

const express = require('express');
const ExcelJS = require('exceljs');
const QRCode  = require('qrcode');
const path    = require('path');

// ---------------------------------------------------------------------------
// App Initialisation
// ---------------------------------------------------------------------------

const app  = express();
const PORT = process.env.PORT || 3000;

/**
 * Path to the Excel workbook that stores all registration records.
 * The file is created automatically on the first registration if it
 * does not already exist.
 */
const EXCEL_FILE = path.join(__dirname, 'registrations.xlsx');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/login
 * ----------------
 * Validates that the submitted email belongs to the @klu.ac.in domain.
 *
 * Request Body:
 *   { email: string }
 *
 * Response:
 *   200 — { success: true }                              (domain match)
 *   403 — { success: false, message: string }            (domain mismatch)
 *   400 — { success: false, message: string }            (missing email)
 */
app.post('/api/login', (req, res) => {
  const { email } = req.body;

  // Guard: email must be present
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Email address is required.'
    });
  }

  // Domain restriction check
  if (email.toLowerCase().trim().endsWith('@klu.ac.in')) {
    return res.json({ success: true });
  }

  return res.status(403).json({
    success: false,
    message: 'Only @klu.ac.in academic emails are allowed.'
  });
});

/**
 * POST /api/register
 * -------------------
 * Registers a delegate by:
 *   1. Appending their details to the Excel workbook.
 *   2. Generating a QR code containing a JSON payload with
 *      all registration details for on-site verification.
 *
 * Request Body:
 *   { name: string, email: string, phone: string, txnId: string }
 *
 * Response:
 *   200 — { success: true,  qrCodeUrl: string }    (data URL of QR)
 *   400 — { success: false, message: string }       (missing fields)
 *   500 — { success: false, message: string }       (file I/O error)
 */
app.post('/api/register', async (req, res) => {
  const { name, email, phone, txnId } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !txnId) {
    return res.status(400).json({
      success: false,
      message: 'All fields (name, email, phone, txnId) are required.'
    });
  }

  try {
    // ------------------------------------------------------------------
    // Step 1: Write to Excel
    // ------------------------------------------------------------------
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile(EXCEL_FILE);
    } catch {
      // File doesn't exist yet — create a fresh workbook with headers
      const sheet = workbook.addWorksheet('Registrations');
      sheet.columns = [
        { header: 'Name',      key: 'name',      width: 25 },
        { header: 'Email',     key: 'email',     width: 30 },
        { header: 'Phone',     key: 'phone',     width: 18 },
        { header: 'TxnID',     key: 'txnId',     width: 20 },
        { header: 'Timestamp', key: 'timestamp', width: 25 }
      ];

      // Style the header row
      sheet.getRow(1).font = { bold: true };
    }

    const worksheet = workbook.getWorksheet('Registrations');

    // Append the new registration row
    worksheet.addRow({
      name:      name,
      email:     email,
      phone:     phone,
      txnId:     txnId,
      timestamp: new Date().toISOString()
    });

    await workbook.xlsx.writeFile(EXCEL_FILE);
    console.log(`[REGISTER] ${email} — saved to Excel`);

    // ------------------------------------------------------------------
    // Step 2: Generate Ticket QR Code
    // ------------------------------------------------------------------

    /**
     * QR Payload — contains all information needed to verify the
     * attendee at the venue. Scanning the QR should return this JSON.
     */
    const ticketPayload = JSON.stringify({
      name,
      email,
      phone,
      txnId,
      event: '10X Club Event 2025',
      valid: true,
      issuedAt: new Date().toISOString()
    });

    const qrCodeUrl = await QRCode.toDataURL(ticketPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark:  '#0f172a',
        light: '#ffffff'
      }
    });

    console.log(`[TICKET]   QR generated for ${email}`);

    // ------------------------------------------------------------------
    // Step 3: Respond with the QR code data URL
    // ------------------------------------------------------------------
    res.json({ success: true, qrCodeUrl });

  } catch (err) {
    console.error('[ERROR] Registration failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'Server error while saving registration. Please try again.'
    });
  }
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       10X Event Hub — Server Ready       ║');
  console.log(`  ║    http://localhost:${PORT}                  ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});