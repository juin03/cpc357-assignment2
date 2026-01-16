#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
// Networking helpers (renamed to avoid collision with core Network.h)
#include "iot_net.h"

// ================== PIN DEFINITIONS ==================
#define TEMP_PIN 17
#define RPM_PIN 25
#define BUZZER_PIN 26
#define GREEN_LED_PIN 27
#define YELLOW_LED_PIN 14 // Previously RED_LED_PIN

// ================== POSTING INTERVAL ==================
#define POST_INTERVAL_MS 5000

// ================== TEMPERATURE ==================
OneWire oneWire(TEMP_PIN);
DallasTemperature DS18B20(&oneWire);

// ================== RPM ==================
volatile unsigned long pulseCount = 0;
unsigned long lastRPMTime = 0;
float rpm = 0;

// ================== MPU6050 ==================
Adafruit_MPU6050 mpu;
float vibRMS = 0;

// ================== VIBRATION SETTINGS ==================
#define VIB_SAMPLES 200
#define VIB_DELAY_US 500  // ~2 kHz
#define VIB_THRESHOLD 0.6 // m/s^2 → tune this!

// ================== ISR ==================
void IRAM_ATTR countPulse()
{
  pulseCount++;
}

// ================== SETUP ==================
void setup()
{
  Serial.begin(115200);

  // LEDs
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);

  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(YELLOW_LED_PIN, LOW);

  // I2C protection
  Wire.setTimeOut(50);
  Wire.begin(21, 22);

  // Temperature
  DS18B20.begin();

  // RPM
  pinMode(RPM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RPM_PIN), countPulse, FALLING);

  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // MPU6050
  if (!mpu.begin())
  {
    Serial.println("MPU6050 not found!");
    while (1)
      ;
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_260_HZ);

  lastRPMTime = millis();

  // WiFi
  connectWiFi();
  // Connect to MQTT broker once after WiFi
  connectMQTT();
}

// ================== LOOP ==================
void loop()
{
  // Keep MQTT connection alive and process inbound traffic
  mqttLoop();

  // -------- TEMPERATURE --------
  DS18B20.requestTemperatures();
  float tempC = DS18B20.getTempCByIndex(0);

  // -------- RPM + VIBRATION every POST_INTERVAL_MS --------
  unsigned long now = millis();
  if (now - lastRPMTime >= POST_INTERVAL_MS)
  {

    // ----- RPM -----
    noInterrupts();
    unsigned long pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    unsigned long elapsedMs = now - lastRPMTime;
    if (elapsedMs == 0)
      elapsedMs = 1; // safety
    // Convert pulses over elapsedMs to revolutions per minute (1 pulse = 1 rev)
    rpm = (pulses * 60000.0f) / (float)elapsedMs;
    lastRPMTime = now;

    // ----- VIBRATION RMS -----
    float sum = 0.0;
    float sumSq = 0.0;

    for (int i = 0; i < VIB_SAMPLES; i++)
    {
      sensors_event_t accel, gyro, temp;
      mpu.getEvent(&accel, &gyro, &temp);

      float a = sqrt(
          accel.acceleration.x * accel.acceleration.x +
          accel.acceleration.y * accel.acceleration.y +
          accel.acceleration.z * accel.acceleration.z);

      sum += a;
      sumSq += a * a;

      delayMicroseconds(VIB_DELAY_US);
      yield(); // feed watchdog
    }

    float mean = sum / VIB_SAMPLES;
    vibRMS = sqrt((sumSq / VIB_SAMPLES) - (mean * mean));

    // ----- DEBUG OUTPUT -----
    Serial.print("Cargo Temp: ");
    Serial.print(tempC, 2);
    Serial.print(" °C | Fan RPM: ");
    Serial.print(rpm);
    Serial.print(" | Road Vib RMS: ");
    Serial.print(vibRMS, 3);
    Serial.println(" m/s^2");

    // ----- LOCAL ACTUATOR LOGIC (One-condition-per-actuator) -----

    // 1. Buzzer -> Vibration / Shock (MPU6050)
    if (vibRMS > VIB_THRESHOLD)
    {
      // Beep bursts: beep-beep-beep
      for (int b = 0; b < 3; b++)
      {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100);
        digitalWrite(BUZZER_PIN, LOW);
        delay(100);
      }
      Serial.println("⚠️ VIBRATION ALARM!");
    }
    else
    {
      digitalWrite(BUZZER_PIN, LOW);
    }

    // 2. Green LED -> Temperature status (DS18B20)
    // Range: 2-8°C OK
    if (tempC >= 2.0 && tempC <= 8.0)
    {
      digitalWrite(GREEN_LED_PIN, HIGH); // Green ON = OK
    }
    else if ((tempC >= 1.0 && tempC < 2.0) || (tempC > 8.0 && tempC <= 9.0))
    {
      // Green BLINK = Near limit
      digitalWrite(GREEN_LED_PIN, (millis() / 500) % 2); 
    }
    else
    {
      digitalWrite(GREEN_LED_PIN, LOW); // Green OFF = Out of range
    }

    // 3. Yellow LED -> Fan/RPM condition (TCRT5000)
    if (rpm > 1000) // stable RPM threshold
    {
      digitalWrite(YELLOW_LED_PIN, HIGH); // Yellow ON = OK
    }
    else if (rpm > 0 && rpm <= 1000)
    {
      // Yellow BLINK = Unstable / Low
      digitalWrite(YELLOW_LED_PIN, (millis() / 500) % 2);
    }
    else
    {
      digitalWrite(YELLOW_LED_PIN, LOW); // Yellow OFF = Stopped
    }

    // ----- POST TO API (MQTT) -----
    unsigned long ts = (unsigned long)(millis() / 1000);
    publishData(tempC, vibRMS, (int)rpm, ts);

    // Note: With MQTT we don't get immediate failure probability back synchronously IN THE SAME Call
    // But we expect the callback to update 'latestRisk' and 'isDanger' soon.

    // Check global flags updated by mqttCallback
    // Threshold set to > 0.8 as per user requirement
    if (latestRisk > 0.8)
    {
      // This block is now redundant for local actuators, but kept for potential cloud-driven actions
      // or if RED_LED_PIN was defined elsewhere for cloud-specific alerts.
      // For now, it will not control any defined LED as YELLOW_LED_PIN replaced RED_LED_PIN.
      // If a RED_LED_PIN is intended for cloud alerts, it needs to be defined.
      Serial.print("⚠️ CLOUD ALARM! Risk: ");
      Serial.print(latestRisk * 100);
      Serial.println("%");
    }
      Serial.println("Failed to queue data.");
    }
  }
}
