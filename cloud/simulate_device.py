import json
import time
import random
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

# Configuration
BROKER = "34.29.164.71"  # Your GCP VM IP
PORT = 1883
TOPIC = "cargo/coldchain/data"

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"✅ Connected to Cloud Broker ({BROKER})")
    else:
        print(f"❌ Connection failed with code {rc}")

def simulate_data():
    client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect

    print(f"🚀 connecting to {BROKER}...")
    try:
        client.connect(BROKER, PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"❌ Could not connect: {e}")
        return

    print("📤 Starting data simulation (Ctrl+C to stop)...")
    
    # Simulation loop
    try:
        while True:
            # Simulate "Normal" conditions with some random noise
            temp = round(random.uniform(3.0, 7.0), 1)
            vib = round(random.uniform(0.1, 0.5), 2)
            rpm = int(random.uniform(1400, 1600))

            # Occasional "Issues" (10% chance)
            if random.random() < 0.1:
                print("⚠️ Simulating FAILURE event...")
                temp = round(random.uniform(9.0, 15.0), 1)  # High Temp
                rpm = int(random.uniform(0, 400))           # Fan Stopped
                vib = round(random.uniform(2.0, 5.0), 2)    # Shock

            payload = {
                "temperature": temp,
                "vibration": vib,
                "rpm": rpm,
                # Timestamp is added by backend if missing, or we can add it here
                "timestamp": int(time.time())
            }

            client.publish(TOPIC, json.dumps(payload))
            print(f"Published: {json.dumps(payload)}")
            
            time.sleep(5) # Send data every 5 seconds

    except KeyboardInterrupt:
        print("\n🛑 Simulation stopped.")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    simulate_data()
