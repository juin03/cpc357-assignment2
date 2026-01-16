import os
from flask import Flask, jsonify, request
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from dotenv import load_dotenv
from flask_cors import CORS

# Reuse models from mqtt_subscriber or redefine here for independence
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for dashboard

# SQL Configuration
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./coldchain.db")
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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

@app.route('/api/history', methods=['GET'])
def get_history():
    minutes = int(request.args.get('minutes', 60))
    limit = int(request.args.get('limit', 1000))
    
    session = SessionLocal()
    try:
        start_time = datetime.utcnow() - timedelta(minutes=minutes)
        
        # Join sensor_data and risk_assessments
        results = session.query(SensorData, RiskAssessment)\
            .join(RiskAssessment, SensorData.id == RiskAssessment.sensor_data_id)\
            .filter(SensorData.timestamp >= start_time)\
            .order_by(desc(SensorData.timestamp))\
            .limit(limit)\
            .all()
            
        history = []
        for sensor, risk in results:
            history.append({
                "id": sensor.id,
                "temperature": sensor.temperature,
                "vibration": sensor.vibration,
                "rpm": sensor.rpm,
                "timestamp": sensor.timestamp.isoformat(),
                "risk_probability": risk.risk_probability,
                "risk_reasons": risk.risk_reasons
            })
            
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/latest', methods=['GET'])
def get_latest():
    session = SessionLocal()
    try:
        result = session.query(SensorData, RiskAssessment)\
            .join(RiskAssessment, SensorData.id == RiskAssessment.sensor_data_id)\
            .order_by(desc(SensorData.timestamp))\
            .first()
            
        if not result:
            return jsonify({"message": "No data found"}), 404
            
        sensor, risk = result
        return jsonify({
            "temperature": sensor.temperature,
            "vibration": sensor.vibration,
            "rpm": sensor.rpm,
            "timestamp": sensor.timestamp.isoformat(),
            "risk_probability": risk.risk_probability,
            "risk_reasons": risk.risk_reasons
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
