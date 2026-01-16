import os
import json
import time
import requests
from google.cloud import firestore
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# SQL Configuration
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./coldchain.db") 
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define SQL Models
class SensorData(Base):
    __tablename__ = "sensor_data"
    id = Column(Integer, primary_key=True, index=True)
    temperature = Column(Float)
    vibration = Column(Float)
    rpm = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(Integer, primary_key=True, index=True)
    sensor_data_id = Column(Integer, ForeignKey("sensor_data.id"))
    risk_probability = Column(Float)
    risk_reasons = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

MQTT_BROKER = os.getenv("MQTT_BROKER", "test.mosquitto.org") 
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "cargo/coldchain/data"
MQTT_ALERT_TOPIC = "cargo/coldchain/alert"

# Initialize Firestore (Keeping for transition/legacy if needed, but SQL is primary)
db = firestore.Client()


def calculate_rule_based_risk(data, sql_session):
    """
    Calculates risk probability based on cold chain rules:
    1. Temperature compliance (2-8°C) + duration
    2. Fan health (is RPM > 500?)
    3. Physical handling (vibration)
    """
    total_risk = 0.0
    risk_reasons = []

    # 1. Temperature Risk
    temp = data['temperature']
    temp_risk = 0.0
    if temp < 2.0 or temp > 8.0:
        # Check last compliant reading in SQL
        last_compliant = sql_session.query(SensorData)\
            .filter(SensorData.temperature >= 2.0, SensorData.temperature <= 8.0)\
            .order_by(SensorData.timestamp.desc())\
            .first()
        
        if last_compliant:
            duration_secs = (datetime.utcnow() - last_compliant.timestamp).total_seconds()
            # Escalate risk based on duration (e.g., 0.1 per minute, max 0.6)
            temp_risk = min(0.2 + (duration_secs / 600), 0.6) 
        else:
            temp_risk = 0.3 # High initial risk if no compliant data found
        risk_reasons.append("Temperature Excursion")

    # 2. Fan Speed Risk
    rpm = data['rpm']
    rpm_risk = 0.0
    if rpm < 500:
        rpm_risk = 0.8 # Critical failure if fan stops
        risk_reasons.append("Cooling Fan Failure")
    elif rpm < 1000:
        rpm_risk = 0.3 # Warning for low RPM
        risk_reasons.append("Unstable Cooling")

    # 3. Vibration Risk
    vib = data['vibration']
    vib_risk = 0.0
    if vib > 2.0: # High shock
        vib_risk = 0.5
        risk_reasons.append("Vibration/Shock Detected")

    # Final Risk calculation
    total_risk = max(temp_risk, rpm_risk, vib_risk)
    
    return total_risk, ", ".join(risk_reasons)

def process_sensor_data(data):
    """
    Processes received sensor data:
    1. SQL Write (Sensor Data)
    2. Rule-based risk calculation
    3. SQL Write (Risk Assessment)
    4. Notifications
    """
    session = SessionLocal()
    try:
        # 1. SQL Write (Sensor Data)
        db_sensor = SensorData(
            temperature=data['temperature'],
            vibration=data['vibration'],
            rpm=data['rpm'],
            timestamp=datetime.utcnow()
        )
        session.add(db_sensor)
        session.commit()
        session.refresh(db_sensor)

        # 2. Rule-based Risk
        mean_prob, risk_type = calculate_rule_based_risk(data, session)

        # 3. SQL Write (Risk Assessment)
        db_risk = RiskAssessment(
            sensor_data_id=db_sensor.id,
            risk_probability=float(mean_prob),
            risk_reasons=risk_type,
            timestamp=datetime.utcnow()
        )
        session.add(db_risk)
        session.commit()


        print(f"✅ Data Processed (SQL): Temp={data['temperature']} Vib={data['vibration']} RPM={data['rpm']} -> Risk={mean_prob:.1%} ({risk_type})")

        # 5. Publish Result back to MQTT (for ESP32 to react)
        alert_payload = {
            "probability": float(mean_prob)
        }
        client.publish(MQTT_ALERT_TOPIC, json.dumps(alert_payload))
        print(f"📤 Published result to {MQTT_ALERT_TOPIC}")

    except Exception as e:
        print(f"❌ Error processing data: {e}")
        session.rollback()
    finally:
        session.close()

# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    print(f"📡 Connected to MQTT Broker with result code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        data = json.loads(payload)
        # Ensure timestamp exists or use current
        if 'timestamp' not in data:
            data['timestamp'] = int(time.time())
            
        process_sensor_data(data)
    except json.JSONDecodeError:
        print("⚠️ Received non-JSON message")
    except Exception as e:
        print(f"❌ Error processing message: {e}")

# Main Execution
if __name__ == "__main__":
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"🚀 Connecting to broker: {MQTT_BROKER}:{MQTT_PORT}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
