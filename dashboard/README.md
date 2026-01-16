# Cold Chain Monitoring Dashboard

Real-time secure web dashboard for monitoring pharmaceutical cargo integrity.

🌐 **Live Dashboard:** https://cpc-coldchain-2025.web.app

## Features

- 🔒 **Secure Connectivity** - Fully HTTPS/WSS encrypted (no mixed content warnings).
- 📡 **Real-Time Updates** - Connects directly to MQTT Broker via **WebSockets (WSS)**.
- 📉 **Historical Data** - Fetches past records from Cloud SQL via **REST API**.
- 📊 **Interactive Charts** - Visualizes Temperature, Vibration, RPM, and Risk.
- ⚠️ **Instant Alerts** - Visual indicators for "High Spoilage Risk".
- 📱 **Responsive Design** - Works on Desktop and Mobile.

## Architecture

```
Dashboard (Access)
   │
   ├── [Direct WSS] ──> MQTT Broker (Live Data)
   │
   └── [HTTPS API] ───> History API (Past Data)
```

**Key Difference**: Unlike typical Firebase apps, this dashboard **does NOT use Firestore**. It communicates directly with our custom backend on Google Compute Engine.

## Configuration

The connection settings are defined in `app.js`:

```javascript
const MQTT_CONFIG = {
    host: "34.29.164.71.sslip.io", // SSL "Magic Domain"
    port: 443,                     // Secure WebSocket Port (Proxied by Nginx)
    path: "/mqtt",
    useSSL: true
};

const API_BASE_URL = "https://34.29.164.71.sslip.io"; // Secured History API
```

## Setup & Deployment

### Prerequisites
- Node.js and npm (for Firebase CLI)
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Local Testing
Due to the secure nature of the backend (HTTPS), local testing works best if you verify the connection to the remote server.

```powershell
python -m http.server 8000
# Visit http://localhost:8000
```

### 2. Deployment
We use **Firebase Hosting** to serve the static files (HTML/JS/CSS).

```powershell
# 1. Login
firebase login

# 2. Deploy
firebase deploy --only hosting
```

**Output:**
```
Hosting URL: https://cpc-coldchain-2025.web.app
```

## File Structure

```
dashboard/
├── index.html          # Main UI structure
├── style.css           # Styling and Animations
├── app.js              # Logic: MQTT (Paho), Charts, API Fetching
├── firebase.json       # Hosting Configuration
├── .firebaserc         # Project Association
└── README.md           # This file
```

## Technology Stack

- **Frontend**: Vanilla JS (ES6+)
- **Charts**: Chart.js 4.4.0
- **Communication**: 
    - **Paho MQTT Client** (WebSockets)
    - **Fetch API** (REST)
- **Hosting**: Firebase Hosting

## Troubleshooting

### ❌ "Connection Refused" / Red LED
- Check if your network blocks Port 443 (rare).
- Ensure the backend Nginx service is running.

### ❌ Charts are empty
- Ensure the **Simulation Script** (`cloud/simulate_device.py`) or **Real ESP32** is running.
- The dashboard only listens for data; it doesn't generate it.

### ❌ "Mixed Content" Error
- This should NOT happen anymore as we upgraded to `https://34.29.164.71.sslip.io`. 
- Always access the dashboard via `https://`, not `http://`.