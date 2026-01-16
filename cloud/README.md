# Cloud Intelligence Layer (Backend)

Backend services for the Pharmaceutical Cold Chain Monitoring System, hosted on Google Cloud Platform.

## Architecture

```
ESP32 (Sensors) → MQTT Broker (Mosquitto) → Python Subscriber → Cloud SQL (PostgreSQL)
                                                                 ↓
                                                            History API (Flask)
```

## Project Structure

```
.
├── mqtt_subscriber.py       # Main service: Listens to MQTT, calculates Risk, saves to SQL
├── history_api.py           # REST API: Serves historical data from SQL to Dashboard
├── schema.sql               # PostgreSQL Database Schema
├── simulate_device.py       # Script to simulate ESP32 data for testing
├── requirements.txt         # Python dependencies
├── vm_setup_guide.md        # Step-by-step guide for GCE VM setup
├── nginx.conf               # Nginx configuration for SSL/WSS proxy
├── setup_vm.sh              # Automated setup script
└── README.md
```

## Setup & Deployment (Google Compute Engine)

The backend runs on an `e2-micro` VM (Debian 11) with the following services:

### 1. Infrastructure
- **Compute Engine**: `34.29.164.71`
- **Cloud SQL**: Managed PostgreSQL instance (`5789` password)
- **Firewall**: Ports 80, 443, 1883 open.

### 2. Services (Systemd)
The following Python scripts run as background services (auto-restart on boot):

1.  **`coldchain-subscriber`**: Runs `mqtt_subscriber.py`
    *   Subscribes to `cargo/coldchain/data`
    *   Evaluates Risk (Rule-Based)
    *   Writes to Cloud SQL
2.  **`coldchain-api`**: Runs `history_api.py`
    *   Runs a Flask server on Port 5000
    *   Provides `/api/history` endpoint

### 3. Security (Nginx + SSL)
We use a "Magic Domain" (`34.29.164.71.sslip.io`) with **Let's Encrypt** SSL to provide secure HTTPS/WSS access.
- **WSS Endpoint**: `wss://34.29.164.71.sslip.io/mqtt` (Proxies to port 8081)
- **HTTPS API**: `https://34.29.164.71.sslip.io` (Proxies to port 5000)

## Python Components

### `mqtt_subscriber.py`
- **Purpose**: Core logic engine.
- **Risk Logic**:
    - **Temp**: Warning if <2°C or >8°C. Risk increases with duration.
    - **Fan**: Critical risk if RPM < 500.
    - **Vibration**: Warning if > 2.0 m/s².
- **Storage**: Uses **SQLAlchemy** to write to `sensor_data` and `risk_assessments` tables.

### `history_api.py`
- **Purpose**: Data access layer for the dashboard.
- **Endpoint**: `GET /api/history?minutes=30`
- **Returns**: JSON array of mixed sensor readings and risk assessments.

### `simulate_device.py`
- **Purpose**: Test the system without hardware.
- **Usage**:
    ```bash
    python simulate_device.py
    ```
    Publishes fake sensor data every 5 seconds (10% chance of critical failure).

## Database Schema (Cloud SQL)

### `sensor_data`
- `id` (PK)
- `temperature` (Float)
- `vibration` (Float)
- `rpm` (Integer)
- `timestamp` (DateTime)

### `risk_assessments`
- `id` (PK)
- `sensor_data_id` (FK)
- `risk_probability` (Float)
- `risk_reasons` (Text)
- `timestamp` (DateTime)

## Monitoring Services

Check status of backend services on the VM:
```bash
sudo systemctl status coldchain-subscriber
sudo systemctl status coldchain-api
sudo systemctl status nginx
```

View logs:
```bash
sudo journalctl -u coldchain-subscriber -n 50 -f
```
