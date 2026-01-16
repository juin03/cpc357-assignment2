// MQTT Configuration
const MQTT_CONFIG = {
    host: "34.29.164.71.sslip.io", // SSL Magic Domain
    port: 443, // HTTPS/WSS Port
    path: "/mqtt",
    clientId: "coldchain_dash_" + Math.random().toString(16).substr(2, 8)
};

// API Configuration
const API_BASE_URL = "https://34.29.164.71.sslip.io"; // Secured History API

let mqttClient;
let currentLatestRisk = 0;

function initMQTT() {
    mqttClient = new Paho.MQTT.Client(MQTT_CONFIG.host, Number(MQTT_CONFIG.port), MQTT_CONFIG.path, MQTT_CONFIG.clientId);

    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;

    const options = {
        useSSL: true, // Secure Connection
        onSuccess: onConnect,
        onFailure: onConnectFailure
    };

    mqttClient.connect(options);
}

function onConnect() {
    console.log("✅ Connected to MQTT Broker via WebSockets");
    mqttClient.subscribe("cargo/coldchain/data");
    mqttClient.subscribe("cargo/coldchain/alert");
}

function onConnectFailure(err) {
    console.error("❌ MQTT Connection Failed:", err);
    setTimeout(initMQTT, 5000); // Retry
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("⚠️ MQTT Connection Lost: " + responseObject.errorMessage);
        setTimeout(initMQTT, 5000);
    }
}

function onMessageArrived(message) {
    if (isPaused) return;

    try {
        const payload = JSON.parse(message.payloadString);

        if (message.destinationName === "cargo/coldchain/data") {
            const timestamp = new Date(); // Use current time for live arrivals
            updateCharts(payload, timestamp.getTime(), currentLatestRisk);
            updateLatestReading(payload, { failure_probability: currentLatestRisk });
            lastUpdateEl.textContent = timestamp.toLocaleString();
        } else if (message.destinationName === "cargo/coldchain/alert") {
            currentLatestRisk = payload.probability;
        }
    } catch (e) {
        console.error("Error parsing MQTT message:", e);
    }
}

// DOM Elements
const lastUpdateEl = document.getElementById('last-update');
const totalReadingsEl = document.getElementById('total-readings');
const predictionsList = document.getElementById('predictions-list');

// Connection status elements removed
const pauseBtn = document.getElementById('pause-btn');
const exportBtn = document.getElementById('export-btn');
const timeValueInput = document.getElementById('time-value');
const timeUnitSelect = document.getElementById('time-unit');
const applyTimeFilterBtn = document.getElementById('apply-time-filter');

// State management
let isPaused = false;
let currentTimeValue = 30;
let currentTimeUnit = 'minutes';


// Data storage for charts

const chartData = {
    labels: [],
    timestamps: [], // Raw timestamps for sliding window logic
    temperature: [],
    vibration: [],
    rpm: [],
    risk: []
};


// Chart configurations
const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
        },
        tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#667eea',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
                label: function (context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += context.parsed.y.toFixed(2);
                        // Add units
                        if (context.dataset.label.includes('Temperature')) {
                            label += ' °C';
                        } else if (context.dataset.label.includes('Vibration')) {
                            label += ' m/s²';
                        } else if (context.dataset.label.includes('Fan')) {
                            label += ' RPM';
                        } else if (context.dataset.label.includes('Risk')) {
                            label += '%';
                        }
                    }
                    return label;
                }
            }
        }
    },
    scales: {
        x: {
            display: true,
            title: {
                display: true,
                text: 'Time'
            },
            ticks: {
                maxTicksLimit: 10
            }
        },
        y: {
            display: true,
            beginAtZero: false
        }
    },
    animation: {
        duration: 750
    }
};

// Initialize individual charts
const temperatureChart = new Chart(document.getElementById('temperatureChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Temperature',
            data: chartData.temperature,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Temperature (°C)'
                }
            }
        }
    }
});

const vibrationChart = new Chart(document.getElementById('vibrationChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Vibration',
            data: chartData.vibration,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Vibration (m/s²)'
                }
            }
        }
    }
});

const rpmChart = new Chart(document.getElementById('rpmChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Fan Speed',
            data: chartData.rpm,
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Fan Speed (RPM)'
                }
            }
        }
    }
});

const riskChart = new Chart(document.getElementById('riskChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Spoilage Risk',
            data: chartData.risk,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Spoilage Risk (%)'
                },
                min: 0,
                max: 100
            }
        }
    }
});

// Combined chart with all metrics
const combinedChart = new Chart(document.getElementById('combinedChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [
            {
                label: 'Temperature (°C)',
                data: chartData.temperature,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                yAxisID: 'y',
                tension: 0.4
            },
            {
                label: 'Vibration (m/s²)',
                data: chartData.vibration,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 2,
                yAxisID: 'y1',
                tension: 0.4
            },
            {
                label: 'RPM (rev/min)',
                data: chartData.rpm,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                borderWidth: 2,
                yAxisID: 'y2',
                tension: 0.4
            },
            {
                label: 'Spoilage Risk (%)',
                data: chartData.risk,
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                borderWidth: 2,
                yAxisID: 'y3',
                tension: 0.4
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#667eea',
                borderWidth: 1,
                padding: 12,
                displayColors: true
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Time'
                },
                ticks: {
                    maxTicksLimit: 10
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Temperature (°C)',
                    color: 'rgb(255, 99, 132)'
                },
                ticks: {
                    color: 'rgb(255, 99, 132)'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Vibration (m/s²)',
                    color: 'rgb(54, 162, 235)'
                },
                ticks: {
                    color: 'rgb(54, 162, 235)'
                },
                grid: {
                    drawOnChartArea: false,
                },
            },
            y2: {
                type: 'linear',
                display: false,
                position: 'left',
                title: {
                    display: true,
                    text: 'Fan Speed (RPM)'
                }
            },
            y3: {
                type: 'linear',
                display: false,
                position: 'right',
                min: 0,
                max: 100
            }
        }
    }
});

// Function to update charts with new data
function updateCharts(data, timestamp, riskValue) {
    const timeLabel = formatTimeLabel(new Date(timestamp));

    // Verify data integrity before pushing
    if (data.temperature === undefined || data.vibration === undefined || data.rpm === undefined) {
        return;
    }

    // Always update internal data structures
    chartData.labels.push(timeLabel);
    chartData.timestamps.push(new Date(timestamp).getTime()); // Store raw ms
    chartData.temperature.push(data.temperature);
    chartData.vibration.push(data.vibration);
    chartData.rpm.push(data.rpm);
    chartData.risk.push(riskValue * 100);

    // Initial trim (triggered by data arrival)
    enforceRollingWindow();

    // Only update visual charts if NOT paused
    if (!isPaused) {
        updateAllCharts();
    }
}

// Helper to update all charts
function updateAllCharts() {
    temperatureChart.update('none');
    vibrationChart.update('none');
    rpmChart.update('none');
    riskChart.update('none');
    combinedChart.update('none');
}

// Helper to remove points outside the time window
function enforceRollingWindow() {
    const duration = getDurationInMillis();
    // Allow a small buffer (e.g. 1 second)
    const cutoffTime = Date.now() - duration - 1000;

    let pointsRemoved = false;

    while (chartData.timestamps.length > 0 && chartData.timestamps[0] < cutoffTime) {
        chartData.labels.shift();
        chartData.timestamps.shift();
        chartData.temperature.shift();
        chartData.vibration.shift();
        chartData.rpm.shift();
        chartData.risk.shift();
        pointsRemoved = true;
    }

    // Safety Cap
    if (chartData.labels.length > 2000) {
        chartData.labels.shift();
        chartData.timestamps.shift();
        chartData.temperature.shift();
        chartData.vibration.shift();
        chartData.rpm.shift();
        chartData.risk.shift();
        pointsRemoved = true;
    }

    return pointsRemoved;
}

// Continuous enforcement of rolling window (every 1 second)
// This ensures the chart "moves" and data drops off even if no new data arrives.
setInterval(() => {
    if (!isPaused && chartData.timestamps.length > 0) {
        const changed = enforceRollingWindow();
        if (changed) {
            updateAllCharts();
            // Also density might change if many points drop off
            // updateChartDensity(chartData.labels.length); // Assuming this function exists elsewhere
        }
    }
}, 1000);

// Removed Firebase Listeners. Real-time now handled by onMessageArrived.
initMQTT();

// Function to update the latest reading box
function updateLatestReading(sensorData, predictionData) {
    const timeObj = sensorData.timestamp instanceof Date ? sensorData.timestamp : new Date(sensorData.timestamp);
    const timestamp = timeObj.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const probability = (predictionData.failure_probability * 100).toFixed(1);
    const riskClass = predictionData.failure_probability <= 0.2 ? 'low' :
        predictionData.failure_probability <= 0.5 ? 'medium' : 'high';

    // Update sensor values
    document.getElementById('latest-temp').textContent = `${sensorData.temperature.toFixed(1)}°C`;
    document.getElementById('latest-vib').textContent = `${sensorData.vibration.toFixed(3)} m/s²`;
    document.getElementById('latest-rpm').textContent = `${sensorData.rpm.toFixed(0)} RPM`;

    // Update timestamp
    document.getElementById('latest-timestamp').textContent = timestamp;

    // Update risk prediction with color coding
    const riskValueEl = document.getElementById('latest-risk');
    riskValueEl.textContent = `${probability}%`;

    // Remove existing risk classes
    riskValueEl.classList.remove('risk-low', 'risk-medium', 'risk-high');
    // Add new risk class
    riskValueEl.classList.add(`risk-${riskClass}`);
}



// 4. Data History Limit Control
function loadHistoricalData() {
    // Clear existing data arrays in place to preserve Chart.js references
    chartData.labels.length = 0;
    chartData.timestamps.length = 0;
    chartData.temperature.length = 0;
    chartData.vibration.length = 0;
    chartData.rpm.length = 0;
    chartData.risk.length = 0;

    const minutes = currentTimeValue * (currentTimeUnit === 'hours' ? 60 : currentTimeUnit === 'days' ? 1440 : 1);

    fetch(`${API_BASE_URL}/api/history?minutes=${minutes}`)
        .then(response => response.json())
        .then(history => {
            if (history.error) throw new Error(history.error);

            // History arrives sorted Newest -> Oldest, reverse it
            history.reverse().forEach(entry => {
                // FORCE UTC: Append 'Z' if missing to prevent Local Time interpretation
                const tsString = entry.timestamp.endsWith('Z') ? entry.timestamp : entry.timestamp + 'Z';
                const date = new Date(tsString);

                const timeLabel = formatTimeLabel(date);

                chartData.labels.push(timeLabel);
                chartData.timestamps.push(date.getTime());
                chartData.temperature.push(entry.temperature);
                chartData.vibration.push(entry.vibration);
                chartData.rpm.push(entry.rpm);
                chartData.risk.push(entry.risk_probability * 100);
            });

            updateAllCharts();

            if (history.length > 0) {
                const latest = history[history.length - 1];
                updateLatestReading(latest, { failure_probability: latest.risk_probability });

                // Update history list
                allPredictions = history.map(h => ({
                    timestamp: h.timestamp,
                    failure_probability: h.risk_probability,
                    temperature: h.temperature,
                    vibration: h.vibration,
                    rpm: h.rpm
                }));
                applyFilters();
            }
        })
        .catch(error => {
            console.error('Error loading historical data:', error);
        });
}

// Helper: Get duration in milliseconds
function getDurationInMillis() {
    let multiplier = 60 * 1000; // minutes
    if (currentTimeUnit === 'hours') multiplier = 60 * 60 * 1000;
    if (currentTimeUnit === 'days') multiplier = 24 * 60 * 60 * 1000;
    return currentTimeValue * multiplier;
}

// Helper: Downsample data to prevent crashes
function downsampleData(data, targetCount = 1000) {
    const length = data.length;
    if (length <= targetCount) return data;

    const step = Math.ceil(length / targetCount);
    const sampled = [];

    for (let i = 0; i < length; i += step) {
        sampled.push(data[i]);
    }

    console.log(`Downsampled from ${length} to ${sampled.length} points (Step: ${step})`);
    return sampled;
}

// Helper: Format time label based on duration
function formatTimeLabel(date) {
    const duration = getDurationInMillis();
    // Use seconds only if duration is very short (<= 5 minutes)
    const showSeconds = duration <= 5 * 60 * 1000;
    // Show date if duration is long (>= 24 hours)
    const showDate = duration >= 24 * 60 * 60 * 1000;

    if (showDate) {
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    if (showSeconds) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    // Default: HH:MM
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}


// 4. Time-Based History Loading handled by the new fetch-based loadHistoricalData above.

// Helper to optimize chart appearance based on data usage
function updateChartDensity(pointCount) {
    const isHighDensity = pointCount > 50;
    // Hide points for high density to reduce clutter, show them on hover
    const radius = isHighDensity ? 0 : 3;
    const hoverRadius = 6;

    const charts = [temperatureChart, vibrationChart, rpmChart, riskChart, combinedChart];

    charts.forEach(chart => {
        if (chart.options.elements && chart.options.elements.point) {
            chart.options.elements.point.radius = radius;
            chart.options.elements.point.hoverRadius = hoverRadius;
        } else {
            // Ensure options structure exists
            chart.options.elements = {
                point: {
                    radius: radius,
                    hoverRadius: hoverRadius
                }
            };
        }
        chart.update('none');
    });
}

applyTimeFilterBtn.addEventListener('click', () => {
    const val = parseInt(timeValueInput.value);
    if (val && val > 0) {
        currentTimeValue = val;
        currentTimeUnit = timeUnitSelect.value;
        loadHistoricalData();
    } else {
        alert('Please enter a valid time value.');
    }
});

// Initial Load
updateChartDensity(0); // Default input
loadHistoricalData();


// Store all predictions for filtering
let allPredictions = [];

// Real-time updates and historical sync now handled by loadHistoricalData and onMessageArrived.

// Display predictions
function displayPredictions(predictions) {
    predictionsList.innerHTML = '';
    totalReadingsEl.textContent = predictions.length;

    if (predictions.length === 0) {
        predictionsList.innerHTML = '<div class="no-results">No data found</div>';
        return;
    }

    predictions.forEach((item) => {
        const predItem = createPredictionItem(item);
        predictionsList.appendChild(predItem);
    });
}

// Search and filter functionality
const searchInput = document.getElementById('search-input');
const riskFilter = document.getElementById('risk-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const riskLevel = riskFilter.value;

    let filtered = allPredictions.filter((item) => {
        const timestamp = new Date(item.timestamp).toLocaleString().toLowerCase();
        const matchesSearch = searchTerm === '' || timestamp.includes(searchTerm);

        let matchesRisk = true;
        if (riskLevel !== 'all') {
            const probability = item.failure_probability;
            if (riskLevel === 'low') {
                matchesRisk = probability <= 0.2;
            } else if (riskLevel === 'medium') {
                matchesRisk = probability > 0.2 && probability <= 0.5;
            } else if (riskLevel === 'high') {
                matchesRisk = probability > 0.5;
            }
        }

        return matchesSearch && matchesRisk;
    });

    displayPredictions(filtered);
}

searchInput.addEventListener('input', applyFilters);
riskFilter.addEventListener('change', applyFilters);

clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    riskFilter.value = 'all';
    applyFilters();
});

// Create prediction list item
function createPredictionItem(item) {
    const div = document.createElement('div');
    div.className = 'prediction-item';

    const probability = (item.failure_probability * 100).toFixed(1);
    const dateObj = new Date(item.timestamp);
    const timestampStr = dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const riskClass = item.failure_probability <= 0.2 ? 'low' :
        item.failure_probability <= 0.5 ? 'medium' : 'high';

    div.innerHTML = `
        <div class="pred-info">
            <div class="pred-time">
                <span class="time-icon">🕐</span>
                ${timestamp}
            </div>
            <div class="pred-sensors">
                <div class="sensor-badge temp">
                    <span class="sensor-icon">🌡️</span>
                    <div class="sensor-details">
                        <span class="sensor-label">Temperature</span>
                        <span class="sensor-number">${item.temperature.toFixed(1)}°C</span>
                    </div>
                </div>
                <div class="sensor-badge vib">
                    <span class="sensor-icon">📊</span>
                    <div class="sensor-details">
                        <span class="sensor-label">Vibration</span>
                        <span class="sensor-number">${item.vibration.toFixed(3)} m/s²</span>
                    </div>
                </div>
                <div class="sensor-badge rpm">
                    <span class="sensor-icon">⚙️</span>
                    <div class="sensor-details">
                        <span class="sensor-label">Fan Speed</span>
                        <span class="sensor-number">${item.rpm.toFixed(0)} RPM</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="pred-risk-container">
            <div class="risk-label">Spoilage Risk</div>
            <div class="pred-risk risk-${riskClass}">${probability}%</div>
        </div>
    `;

    return div;
}

// Connection health handled by initMQTT()

// Clear all data functionality
const clearAllBtn = document.getElementById('clear-all-btn');

clearAllBtn.addEventListener('click', () => {
    alert('Clear database function is temporarily disabled for SQL transition. Please use the SQL console to reset data.');
});

// ==========================================
// New Features Implementation
// ==========================================


// 2. Pause/Resume Functionality
pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;

    if (isPaused) {
        pauseBtn.innerHTML = '▶️ Resume Updates';
        pauseBtn.classList.add('paused');
        pauseBtn.title = "Resume real-time updates (data is still being collected)";
    } else {
        pauseBtn.innerHTML = '⏸️ Pause Updates';
        pauseBtn.classList.remove('paused');
        pauseBtn.title = "Pause real-time updates";

        // Immediate refresh upon resume to show data collected while paused
        temperatureChart.update();
        vibrationChart.update();
        rpmChart.update();
        riskChart.update();
        combinedChart.update();
    }
});


// 3. Export to CSV Functionality
exportBtn.addEventListener('click', () => {
    if (allPredictions.length === 0) {
        alert('No data available to export.');
        return;
    }

    // CSV Headers
    const headers = ['Timestamp', 'Temperature (C)', 'Vibration (m/s2)', 'RPM', 'Failure Probability (%)', 'Risk Level'];

    // Map data to CSV rows
    const rows = allPredictions.map(item => {
        const timestamp = new Date(item.timestamp).toISOString();
        const temp = item.temperature.toFixed(2);
        const vib = item.vibration.toFixed(4);
        const rpm = item.rpm.toFixed(0);
        const prob = (item.failure_probability * 100).toFixed(2);

        let risk = 'Low';
        if (item.failure_probability > 0.5) risk = 'High';
        else if (item.failure_probability > 0.2) risk = 'Medium';

        return [timestamp, temp, vib, rpm, prob, risk].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `motor_health_data_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
