from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT count(*) FROM sensor_data"))
    count = result.scalar()
    print(f"Total rows in sensor_data: {count}")
    
    result = conn.execute(text("SELECT timestamp FROM sensor_data ORDER BY timestamp DESC LIMIT 1"))
    latest = result.scalar()
    print(f"Latest timestamp: {latest}")
