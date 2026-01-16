# Pharmaceutical Cold Chain Monitoring System

IoT-based real-time integrity monitoring for sensitive medical cargo using ESP32, rule-based risk detection, and cloud-synced dashboard.

**🎯 UN SDG 3** - Good Health and Well-being

---

## 📚 Documentation

- **This Guide**: [`README.md`](README.md) - Quick start guide, architecture overview, and project structure.
- **Cloud Layer**: See [`cloud/README.md`](cloud/README.md) - MQTT setup, Cloud SQL, Nginx/SSL, and Systemd services.
- **Dashboard**: See [`dashboard/README.md`](dashboard/README.md) - Features, WebSocket (WSS) connection, and Firebase Hosting.

---

## 📁 Project Structure

```
├── cloud/          # Backend Services (MQTT, SQL Subscriber, API)
├── dashboard/      # Web Dashboard (Firebase Hosting)
├── esp32/          # Arduino firmware for edge device
└── README.md       # This file
```

---

## 🚀 Quick Start

### 1. **Dashboard** (View real-time data)
Visit: **https://cpc-coldchain-2025.web.app**

*   ✅ **Secure HTTPS**: Hosted on Firebase with SSL.
*   ✅ **Real-Time**: Uses secure WebSockets (WSS).

### 2. **Cloud Layer** (Backend service)
The backend runs on a **Google Compute Engine VM** (`34.29.164.71`) and manages:
1.  **Mosquitto Broker**: Handles MQTT traffic.
2.  **Subscriber Service**: Processes data and stores it in **Cloud SQL**.
3.  **History API**: Serves historical charts via HTTPS.
4.  **Nginx**: Provides SSL termination for secure connections.

See [`cloud/README.md`](cloud/README.md) for details.

### 3. **ESP32** (Edge Device)
The ESP32 publishes sensor data to the MQTT broker:

**Payload Format:**
```json
{
  "temperature": 5.5,
  "vibration": 0.03,
  "rpm": 2500
}
```

**Workflow:**
1. Collects temperature, vibration, and RPM.
2. Performs edge pre-processing.
3. Publishes to MQTT topic `cargo/coldchain/data`.
4. Alerts via local buzzer/LEDs based on rule-based logic.

---

## 🔧 Development

### Cloud Layer
```powershell
cd cloud
# See cloud/README.md for VM setup, SQL schema, and testing
```

### Dashboard
```powershell
cd dashboard
# See dashboard/README.md for features and deployment
```

---

## 🏗️ Architecture

```
ESP32 / Simulator → MQTT Broker (Mosquitto) → Python Subscriber → Cloud SQL (PostgreSQL)
                                            ↓                   ↓
                                      Rule-based Risk      History API (Flask)
                                                                ↓
                                                           Web Dashboard
                                                    (Reads Live via WSS, History via HTTPS)
```

**Technologies:**
- **Hardware**: ESP32 (Temperature, Vibration, RPM sensors)
- **Backend**: Python (Paho MQTT, SQLAlchemy, Flask)
- **Broker**: Mosquitto (Ports 1883/8081)
- **Database**: Google Cloud SQL (PostgreSQL)
- **Security**: Nginx Reverse Proxy + Let's Encrypt SSL
- **Frontend**: Vanilla JS, Chart.js, Firebase Hosting
- **Cloud**: Google Cloud Platform (GCP)

---

## ⚡ Quick Commands

```powershell
# Simulate Device (Send Data)
cd cloud
python simulate_device.py

# Deploy Dashboard
cd dashboard
firebase deploy --only hosting
```

---

## 🌐 Live URLs

- **Dashboard**: https://cpc-coldchain-2025.web.app
- **Mosquitto (WSS)**: wss://34.29.164.71.sslip.io/mqtt
- **History API**: https://34.29.164.71.sslip.io/api/history

---

## 📊 Features

✅ **Real-time cold chain monitoring** (Sub-second latency)
✅ **Rule-based spoilage risk detection** (Transparent logic)
✅ **Secure HTTPS/WSS Connectivity** ("Magic Domain" SSL)
✅ **Interactive multi-line charts** (Chart.js)
✅ **Search & filter history** (via SQL API)
✅ **Mobile-responsive dashboard**

---

**For detailed documentation, refer to:**
- [`cloud/README.md`](cloud/README.md)
- [`dashboard/README.md`](dashboard/README.md)
