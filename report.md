# Project Evolution Report: Pharmaceutical Cold Chain Monitoring System

## 1. Executive Summary
This document details the architectural pivot and technical hardening of the Pharmaceutical Cold Chain Monitoring project. The system has evolved from a prototype-level architecture relying on managed proprietary services (Firebase) to a robust, industry-standard hybrid cloud architecture utilizing Google Compute Engine (GCE), SQL databases, and Secure WebSockets.

## 2. Technology Stack Migration

| Component | Old Architecture (Prototype) | New Architecture (Production-Ready) | Key Benefit |
| :--- | :--- | :--- | :--- |
| **Database** | Firebase Firestore (NoSQL) | **Google Cloud SQL (PostgreSQL)** | Structured data, complex queries, standard SQL compliance. |
| **Compute** | Serverless / Local Script | **Google Compute Engine (VM)** | Full control over runtime, persistent background services. |
| **Real-Time Data** | Firestore Real-time Listeners | **MQTT over WebSockets (WSS)** | Sub-second latency, dramatically lower cost/bandwidth. |
| **Connectivity** | HTTP (Unencrypted IP) | **HTTPS (SSL/TLS via Nginx)** | Secure data transmission, eliminates browser "Mixed Content" blocks. |
| **API Logic** | Direct Database Access from Client | **Python Flask REST API** | improved security (DB credentials hidden on server). |
| **Intelligence** | Basic ML Model (Black box) | **Rule-Based Risk Engine** | Transparent, deterministic logic (critical for medical compliance). |

## 3. Detailed Architectural Changes

### 3.1 Database Transformation (NoSQL &rarr; SQL)
*   **Previously**: Used Firestore. While easy to start, it made historical data analysis and standard reporting difficult due to its document-based nature.
*   **Now**: Migrated to **Google Cloud SQL (PostgreSQL)**. using `SQLAlchemy` ORM.
*   **Impact**: We can now run standard SQL queries (`SELECT * FROM sensor_data...`) to analyze trends over time, which is essential for audit trails in pharmaceutical logistics.

### 3.2 Security Implementation (The "Magic Domain")
*   **Challenge**: Modern browsers block insecure requests (HTTP) when the main site is secure (HTTPS). Our VM originally only had a raw IP address.
*   **Solution**: Implemented a **"Magic Domain" SSL Strategy**.
    *   Using `sslip.io` to map our IP (`34.29.164.71`) to a valid hostname (`34.29.164.71.sslip.io`).
    *   Deployed **Nginx** as a Reverse Proxy.
    *   Secured with **Let's Encrypt** SSL certificates.
*   **Result**: The dashboard now communicates securely via `https://` (API) and `wss://` (MQTT) without security warnings.

### 3.3 Data Flow Decoupling
*   **Old Flow**: Device &rarr; Firestore &rarr; Dashboard. (High latency, expensive).
*   **New Flow (Hybrid)**: 
    *   **Hot Path (Live)**: Device &rarr; MQTT Broker &rarr; Dashboard (WebSockets). Instant updates.
    *   **Cold Path (History)**: Device &rarr; SQL Subscriber &rarr; Cloud SQL &rarr; Flask API &rarr; Dashboard. Permanent storage.

## 4. Key Challenges Solved

### 4.1 "Missing Historical Data" (Timezone Bug)
*   **Issue**: Historical data stored in Cloud SQL was not appearing on the dashboard.
*   **Root Cause**: The SQL database stored timestamps in **UTC**, but the browser (Malaysia Time, UTC+8) interpreted them as local time, causing an 8-hour shift that pushed data out of the "Last 30 Minutes" view.
*   **Fix**: Enforced **ISO-8601 UTC** formatting (`Z` suffix) in the Dashboard parser to ensure globally synchronized time.

### 4.2 "Double CORS" Conflict
*   **Issue**: The Dashboard failed to fetch API data despite the server running.
*   **Root Cause**: Both the Nginx Proxy and the Flask Application were adding `Access-Control-Allow-Origin` headers. Browsers reject responses with multiple CORS headers.
*   **Fix**: Reconfigured Nginx to pass requests transparently, allowing Flask to manage CORS policies alone.

## 5. Conclusion
The new architecture is **production-ready**. It uses standard protocols (MQTT, SQL, HTTPS) that are scalable, secure, and cost-effective, moving away from the limitations of the initial prototype.
