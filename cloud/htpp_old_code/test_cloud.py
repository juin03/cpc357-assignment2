import requests
import json
import time
import os
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Cloud Run URL from environment variable
url = os.getenv("CLOUD_RUN_URL", "https://motor-health-api-250203692178.asia-southeast1.run.app/predict")

# Generate 5 test cases with varying values
test_cases = []

print("Generating 8 diverse test cases...\n")

for i in range(8):
    # Generate realistic varying sensor data based on train_model.py definitions
    
    # 3 Success Cases (Normal Operation)
    if i < 3:
        temp = random.uniform(20, 30)
        vib = random.uniform(0.3, 0.6)
        rpm = random.uniform(2000, 3000)
        case_type = "Normal"
        
    # 5 Failure Cases
    elif i == 3:
        # Failure B/D: High Vibration and/or Temp (Medium-High Risk)
        temp = random.uniform(40, 50) 
        vib = random.uniform(1.5, 2.0) 
        rpm = random.uniform(2000, 3000)
        case_type = "High Risk (Vib/Temp)"
        
    elif i == 4:
        # Failure C: Low RPM (Medium-High Risk)
        temp = random.uniform(20, 30)
        vib = random.uniform(0.3, 0.6)
        rpm = random.uniform(1000, 1800)
        case_type = "High Risk (Low RPM)"

    # NEW: >80% Failure Probability Cases
    elif i == 5:
        # Critical Overheat
        temp = random.uniform(65, 80) # > 60 is critical
        vib = random.uniform(0.3, 0.6)
        rpm = random.uniform(2000, 3000)
        case_type = "CRITICAL: Overheat"

    elif i == 6:
        # Extreme Vibration
        temp = random.uniform(20, 30)
        vib = random.uniform(3.5, 5.0) # > 3.0 is critical
        rpm = random.uniform(2000, 3000)
        case_type = "CRITICAL: Vibration"

    else: # i == 7
        # Motor Stall / Locked Rotor
        temp = random.uniform(50, 70) # Getting hot
        vib = random.uniform(4.0, 6.0) # Shaking violently
        rpm = random.uniform(0, 500) # Stalled
        case_type = "CRITICAL: STALL"
    
    test_cases.append({
        "name": f"Test {i+1} ({case_type})",
        "data": {
            "temperature": round(temp, 1),
            "vibration": round(vib, 3),
            "rpm": int(rpm),
            "timestamp": int(time.time())
        }
    })

print(f"Testing Cloud Run API with {len(test_cases)} requests...\n")

results = []
for idx, test in enumerate(test_cases, 1):
    print(f"📊 {test['name']}: temp={test['data']['temperature']}°C, "
          f"vib={test['data']['vibration']}, rpm={test['data']['rpm']}", end=" → ")
    
    try:
        response = requests.post(url, json=test['data'])
        
        if response.status_code == 200:
            result = response.json()
            prob = result['failure_probability']
            
            # Check if error occurred
            if prob is None and 'error' in result:
                print(f"✗ API Error: {result['error']}")
            else:
                risk_level = "LOW" if prob < 0.3 else "MED" if prob < 0.7 else "HIGH"
                print(f"✓ {prob:.1%} [{risk_level}]")
                results.append(prob)
        else:
            print(f"✗ Error: {response.status_code}")
    except Exception as e:
        print(f"✗ Connection error: {e}")
    
    # Small delay to avoid overwhelming the API
    time.sleep(0.5)

# Test 6: Send invalid data to trigger error handling
print(f"\n📊 Test 6 (Error Test): Sending invalid data to test error handling", end=" → ")
try:
    invalid_data = {
        "temperature": 50.0,
        "vibration": 0.05,
        "rpm": 1500,
        "timestamp": "invalid_timestamp"  # This should cause an error
    }
    response = requests.post(url, json=invalid_data)
    
    if response.status_code == 200:
        result = response.json()
        if 'error' in result and result['failure_probability'] is None:
            print(f"✓ Error handled correctly: {result['error'][:50]}...")
        else:
            print(f"✗ Unexpected success: {result}")
    elif response.status_code == 422:
        print(f"✓ Validation error (422): Invalid input caught by Pydantic")
    else:
        print(f"✗ Unexpected status: {response.status_code}")
except Exception as e:
    print(f"✗ Connection error: {e}")

# Test 7: Send valid types but extreme timestamp to trigger try-except
print(f"\n📊 Test 7 (Runtime Error Test): Sending extreme timestamp value", end=" → ")
try:
    extreme_data = {
        "temperature": 50.0,
        "vibration": 0.05,
        "rpm": 1500,
        "timestamp": 99999999999999  # Extremely large timestamp, beyond datetime range
    }
    response = requests.post(url, json=extreme_data)
    
    if response.status_code == 200:
        result = response.json()
        if 'error' in result and result['failure_probability'] is None:
            print(f"✓ Runtime error caught by try-except: {result['error'][:60]}...")
        else:
            print(f"✗ Unexpected success: {result}")
    else:
        print(f"✗ Unexpected status: {response.status_code}")
except Exception as e:
    print(f"✗ Connection error: {e}")

print(f"\n{'='*60}")
print(f"✅ Completed {len(results)}/{len(test_cases)} requests")
print(f"📈 Probability range: {min(results):.1%} - {max(results):.1%}")
print(f"📊 Average risk: {sum(results)/len(results):.1%}")
print(f"🌐 ESP32 URL: {url}")
print(f"{'='*60}")
