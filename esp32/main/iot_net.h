#pragma once

#include <WiFi.h>
#include <PubSubClient.h> // Make sure to install this library
#include <ArduinoJson.h>

// Hardcoded MQTT Broker (set to your Cloud VM IP)
// Ensure this matches the broker your cloud subscriber uses
static const char *MQTT_BROKER = "34.177.80.102";
static const int MQTT_PORT = 1883;
static const char *MQTT_TOPIC = "motor/health/data";
static const char *MQTT_SUB_TOPIC = "motor/health/alert";
static const char *MQTT_CLIENT_PREFIX = "ESP32Client-";

// Shared variable for risk (0.0 to 1.0)
float latestRisk = 0.0;

// Provide your WiFi credentials via build flags or set here if needed
#ifndef WIFI_SSID
#define WIFI_SSID "johnas"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "leeyingshen"
#endif

WiFiClient espClient;
PubSubClient client(espClient);

// Callback function for incoming MQTT messages
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    Serial.print("📨 Message arrived [");
    Serial.print(topic);
    Serial.print("]: ");

    String message;
    for (unsigned int i = 0; i < length; i++)
    {
        message += (char)payload[i];
    }
    Serial.println(message);

    // Parse JSON
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (!error)
    {
        if (doc.containsKey("probability"))
        {
            latestRisk = doc["probability"];
        }
        Serial.print("Parsed Risk: ");
        Serial.print(latestRisk * 100);
        Serial.println("%");
    }
    else
    {
        Serial.print("deserializeJson() failed: ");
        Serial.println(error.c_str());
    }
}

inline void connectWiFi()
{
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_MODE_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("✓ WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("✗ WiFi connection failed! Check SSID/password.");
    }
}

inline void connectMQTT()
{
    client.setServer(MQTT_BROKER, MQTT_PORT);
    client.setCallback(mqttCallback); // Set callback here
    client.setKeepAlive(60);
    client.setBufferSize(512);
    // Build a unique client ID from MAC to avoid collisions
    String clientId = String(MQTT_CLIENT_PREFIX) + WiFi.macAddress();
    clientId.replace(":", "");

    while (!client.connected())
    {
        Serial.print("Connecting to MQTT... ");
        if (client.connect(clientId.c_str()))
        {
            Serial.println("connected");
            // Subscribe to the alert topic
            client.subscribe(MQTT_SUB_TOPIC);
            Serial.print("Subscribed to: ");
            Serial.println(MQTT_SUB_TOPIC);
        }
        else
        {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}

inline void mqttLoop()
{
    if (!client.connected())
    {
        connectMQTT();
    }
    client.loop();
}

inline float publishData(float temperature, float vibration, int rpm, unsigned long timestamp)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("✗ WiFi not connected!");
        return -1.0f;
    }

    if (!client.connected())
    {
        connectMQTT();
    }

    StaticJsonDocument<200> doc;
    doc["temperature"] = temperature;
    doc["vibration"] = vibration;
    doc["rpm"] = rpm;
    doc["timestamp"] = timestamp;

    String payload;
    serializeJson(doc, payload);

    Serial.print("📤 Publishing to MQTT... ");
    if (client.publish(MQTT_TOPIC, payload.c_str()))
    {
        Serial.println("✓ Success!");
        return latestRisk; // Return the latest known risk from cloud
    }
    else
    {
        Serial.println("✗ Failed!");
        return -1.0f;
    }
}
