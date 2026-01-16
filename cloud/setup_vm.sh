#!/bin/bash
set -e

echo "Updating packages..."
sudo apt-get update -y

echo "Installing Mosquitto and Python dependencies..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mosquitto mosquitto-clients python3-pip python3-venv libpq-dev

echo "Configuring Mosquitto for WebSockets..."
sudo bash -c 'cat > /etc/mosquitto/conf.d/websocket.conf <<EOF
listener 1883
allow_anonymous true

listener 8081
protocol ws
allow_anonymous true
EOF'

echo "Restarting Mosquitto..."
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto

echo "Verifying Mosquitto..."
systemctl is-active mosquitto

echo "Setup Complete!"
