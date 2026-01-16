# MQTT Broker & Cloud Service Setup Guide

This guide details how to set up a Google Cloud VM to host your MQTT Broker (Mosquitto) and run the Python subscriber service using Google Artifact Registry.

## 1. Create a Google Cloud VM

1.  **Go to GCP Console**: Navigate to [Compute Engine > VM Instances](https://console.cloud.google.com/compute/instances).
2.  **Click "Create Instance"**.
3.  **Machine Configuration**:
    *   **Name**: `mqtt-broker-vm` (or similar)
    *   **Region**: `asia-southeast1` (Singapore).
    *   **Machine Type**: `e2-micro` (Free Tier) or `e2-small`.
4.  **Boot Disk**: Default (Debian 11).
5.  **Identity and API Access**:
    *   **Service Account**: Compute Engine default service account.
    *   **Access Scopes**:
        *   Select **"Set access for each API"**.
        *   **Artifact Registry API**: `Read Only` (Allows pulling images).
        *   **Cloud Datastore API**: `Enabled` (Allows writing to Firestore).
        *   Alternatively, select **"Allow full access to all Cloud APIs"** for simplicity.
6.  **Firewall**:
    *   Check **Allow HTTP traffic**.
    *   Check **Allow HTTPS traffic**.
7.  **Advanced Options > Networking**:
    *   Add network tag: `mqtt-broker`.
8.  **Click Create**.

### Configuration: Firewall Rule for MQTT
1.  Go to [VPC Network > Firewall](https://console.cloud.google.com/networking/firewalls/list).
2.  Click **Create Firewall Rule**.
3.  **Name**: `allow-mqtt-1883`.
4.  **Target tags**: `mqtt-broker`.
5.  **Source IPv4 ranges**: `0.0.0.0/0`.
6.  **Protocols and ports**: `tcp:1883`.
7.  Click **Create**.

---

## 2. Install Mosquitto & Docker on VM

SSH into your VM and run:

```bash
# 1. Install Mosquitto
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto

# 2. Configure Mosquitto (External Access)
sudo bash -c 'echo -e "listener 1883\nallow_anonymous true" > /etc/mosquitto/conf.d/external.conf'
sudo systemctl restart mosquitto

# 3. Install Docker
sudo apt install -y docker.io
sudo usermod -aG docker $USER
# (You might need to logout and login again for group changes to take effect)
```

---

## 3. Build & Deploy with Google Artifact Registry

### A. Setup Artifact Registry (One-time)

1.  **Enable API**: Search for "Artifact Registry API" in GCP Console and enable it.
2.  **Create Repository**:
    *   Go to **Artifact Registry > Repositories**.
    *   Click **Create Repository**.
    *   **Name**: `motor-health-repo`
    *   **Format**: `Docker`
    *   **Region**: `asia-southeast1` (Same as VM)
    *   Click **Create**.

### B. Build & Push (From Local Machine)

1.  **Configure Docker Authentication**:
    (Requires Google Cloud SDK installed locally)
    ```bash
    gcloud auth configure-docker asia-southeast1-docker.pkg.dev
    ```

2.  **Build & Tag**:
    (Run inside `cloud` folder)
    ```bash
    # Format: [REGION]-docker.pkg.dev/iot-project-481405/[REPO-NAME]/[IMAGE-NAME]:[TAG]
    # Replace [PROJECT-ID] with your actual project ID (e.g., iot-project-481405)
    docker build -t asia-southeast1-docker.pkg.dev/iot-project-481405/motor-health-repo/mqtt-bridge:v1 .
    ```

3.  **Push**:
    ```bash
    docker push asia-southeast1-docker.pkg.dev/iot-project-481405/motor-health-repo/mqtt-bridge:v1
    ```

### C. Deploy on VM

1.  **Configure Docker Auth on VM**:
    ```bash
    gcloud auth configure-docker asia-southeast1-docker.pkg.dev
    ```
    *(If command not found, just run `docker login -u oauth2accesstoken -p "$(gcloud auth print-access-token)" https://asia-southeast1-docker.pkg.dev`)*

2.  **Pull & Run**:
    ```bash
    # Pull
    docker pull asia-southeast1-docker.pkg.dev/iot-project-481405/motor-health-repo/mqtt-bridge:v1

    # Run
    docker run -d \
      --name mqtt-bridge \
      --network host \
      -e MQTT_BROKER="localhost" \
      -e MQTT_PORT=1883 \
      -e TELEGRAM_BOT_TOKEN="your_token_here" \
      -e TELEGRAM_CHAT_ID="your_chat_id_here" \
      asia-southeast1-docker.pkg.dev/iot-project-481405/motor-health-repo/mqtt-bridge:v1
    ```

## 4. Updates for ESP32
1.  Copy the **External IP Address** of your VM.
2.  Update `iot_net.h` with this IP.
3.  Re-flash ESP32.
