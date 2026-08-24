# 10X Event Hub 🎫

> A premium event management website for the **KLU 10X Club** — built with Node.js, Express, and vanilla HTML/CSS/JS.

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **Academic Login** | Only `@klu.ac.in` email addresses can access the portal |
| **Delegate Registration** | Collects full name, email, and contact number |
| **UPI Payment** | Displays a fixed QR code for UPI payment; user enters Transaction ID |
| **Digital Event Pass** | Generates a QR-coded ticket containing all registration details |
| **Excel Integration** | Every registration is automatically saved to `registrations.xlsx` |
| **Print-friendly Ticket** | Event pass is optimised for `Ctrl+P` printing |

---

## 🗂 Project Structure

```
event-app/
├── public/                  # Static frontend files
│   ├── index.html           # Login page (email verification)
│   ├── register.html        # Delegate registration form
│   ├── payment.html         # UPI QR code + transaction ID entry
│   ├── ticket.html          # Digital event pass with QR
│   ├── styles.css           # Shared design system (all CSS)
│   └── qr_static.png        # Static UPI QR code image
├── server.js                # Express backend (API + static server)
├── registrations.xlsx       # Auto-generated Excel file with records
├── package.json             # Node.js dependencies and scripts
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- npm (comes with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/10xclubkare/10X-EVENT-SITE.git
cd 10X-EVENT-SITE

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The server will start at **http://localhost:3000**.

---

## 🔌 API Reference

### `POST /api/login`

Validates that the email belongs to the `@klu.ac.in` domain.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | `string` | ✅ | Academic email address |

**Success Response** (200):
```json
{ "success": true }
```

**Error Response** (403):
```json
{ "success": false, "message": "Only @klu.ac.in academic emails are allowed." }
```

---

### `POST /api/register`

Registers a delegate, saves to Excel, and generates a QR ticket.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | ✅ | Full name of the attendee |
| `email` | `string` | ✅ | Verified academic email |
| `phone` | `string` | ✅ | Contact number |
| `txnId` | `string` | ✅ | UPI Transaction / Reference ID |

**Success Response** (200):
```json
{
  "success": true,
  "qrCodeUrl": "data:image/png;base64,..."
}
```

**Error Response** (500):
```json
{ "success": false, "message": "Server error while saving registration." }
```

---

## 🎨 Design System

The frontend uses a **dark-mode glassmorphism** design with the following tokens:

| Token | Value | Usage |
| --- | --- | --- |
| `--accent` | `#6c63ff` | Primary interactive colour |
| `--bg-dark` | `#0a0e1a` | Page background |
| `--glass-bg` | `rgba(255,255,255,0.06)` | Card backgrounds |
| `--success` | `#10b981` | Confirmations & verified states |
| Font | Outfit | All text via Google Fonts |

All styles are in [`public/styles.css`](public/styles.css).

---

## 📊 Excel Data Mapping

Registration data is saved to `registrations.xlsx` with the following columns:

| Column | Description | Example |
| --- | --- | --- |
| **Name** | Attendee's full name | John Doe |
| **Email** | Verified KLU email | john@klu.ac.in |
| **Phone** | Contact number | +91 9876543210 |
| **TxnID** | UPI Reference ID | 302145678901 |
| **Timestamp** | ISO 8601 registration time | 2025-01-15T14:30:00.000Z |

---

## 📱 QR Code Payload

The QR code on the event pass encodes a JSON payload:

```json
{
  "name": "John Doe",
  "email": "john@klu.ac.in",
  "phone": "+91 9876543210",
  "txnId": "302145678901",
  "event": "10X Club Event 2025",
  "valid": true,
  "issuedAt": "2025-01-15T14:30:00.000Z"
}
```

Scan this at the registration desk to verify entry.

---

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **QR Generation**: `qrcode` npm package
- **Data Storage**: `exceljs` npm package (`.xlsx`)
- **Font**: [Google Fonts — Outfit](https://fonts.google.com/specimen/Outfit)

---

## 📄 License

This project is built for the **10X Club at KL University**. Internal use only.
