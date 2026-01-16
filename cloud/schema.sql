-- Sensor Data Table
CREATE TABLE sensor_data (
    id SERIAL PRIMARY KEY,
    temperature FLOAT NOT NULL,
    vibration FLOAT NOT NULL,
    rpm FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Assessments Table
CREATE TABLE risk_assessments (
    id SERIAL PRIMARY KEY,
    sensor_data_id INTEGER REFERENCES sensor_data(id),
    risk_probability FLOAT NOT NULL,
    risk_reasons TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
