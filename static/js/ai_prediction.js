document.addEventListener('DOMContentLoaded', function() {
    let predictionChart = null;
    const cryptoSelect = document.getElementById('crypto-select');
    const timeframeSelect = document.getElementById('timeframe-select');
    const modelSelect = document.getElementById('model-select');
    
    // Initialize prediction chart
    function initPredictionChart(data) {
        if (predictionChart) {
            predictionChart.destroy();
        }
        
        const chartType = document.querySelector('.chart-type-btn.active').dataset.type;
        const ctx = document.getElementById('predictionChart').getContext('2d');
        predictionChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Actual Price',
                    data: data.actual,
                    borderColor: '#4CAF50',
                    backgroundColor: chartType === 'bar' ? '#4CAF50' : 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Predicted Price',
                    data: data.predicted,
                    borderColor: '#2196F3',
                    backgroundColor: chartType === 'bar' ? '#2196F3' : 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderDash: [5, 5]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }
    
    // Update market insights
    function updateMarketInsights(data) {
        // Update technical indicators
        const technicalIndicators = document.getElementById('technical-indicators');
        if (data.technical_indicators) {
            technicalIndicators.innerHTML = Object.entries(data.technical_indicators)
                .map(([indicator, value]) => `
                    <div class="indicator">
                        <span class="indicator-name">${indicator}:</span>
                        <span class="indicator-value">${value}</span>
                    </div>
                `).join('');
        }

        // Update market sentiment
        const marketSentiment = document.getElementById('market-sentiment');
        if (data.market_sentiment) {
            marketSentiment.innerHTML = `
                <div class="sentiment-score ${data.market_sentiment.score >= 0 ? 'positive' : 'negative'}">
                    ${data.market_sentiment.score >= 0 ? 'Bullish' : 'Bearish'} (${Math.abs(data.market_sentiment.score)}%)
                </div>
                <div class="sentiment-details">
                    ${data.market_sentiment.details}
                </div>
            `;
        }

        // Update risk assessment
        const riskAssessment = document.getElementById('risk-assessment');
        if (data.risk_assessment) {
            riskAssessment.innerHTML = `
                <div class="risk-level ${data.risk_assessment.level.toLowerCase()}">
                    Risk Level: ${data.risk_assessment.level}
                </div>
                <div class="risk-details">
                    ${data.risk_assessment.details}
                </div>
            `;
        }
    }
    
    // Update key factors
    function updateKeyFactors(data) {
        const container = document.getElementById('feature-importance');
        container.innerHTML = data.factors.map(factor => `
            <div class="feature-item">
                <div class="feature-header">
                    <span class="feature-name">${factor.name}</span>
                    <span class="feature-score">${factor.importance.toFixed(2)}</span>
                </div>
                <div class="feature-bar">
                    <div class="bar-fill" style="width: ${factor.importance * 100}%"></div>
                </div>
            </div>
        `).join('');
    }
    
    // Update prediction history
    function updatePredictionHistory(data) {
        const container = document.getElementById('prediction-history');
        container.innerHTML = data.history.map(entry => `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-date">${entry.date}</span>
                    <span class="history-accuracy ${entry.accuracy >= 90 ? 'positive' : 'negative'}">${entry.accuracy}%</span>
                </div>
                <div class="history-details">
                    <span class="history-model">${entry.model}</span>
                    <span class="history-timeframe">${entry.timeframe}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Fetch prediction data
    async function fetchPredictionData() {
        try {
            const response = await fetch('/api/predictions');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Update each section with the new data
            updateKeyFactors(data.keyFactors);
            updateHistoricalPredictions(data.historicalPredictions);
            updateMarketInsights(data.marketInsights);
            
        } catch (error) {
            console.error('Error fetching prediction data:', error);
            showErrorMessage();
        }
    }
    
    // Event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.chart-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Reinitialize chart with current data
            if (predictionChart && predictionChart.data) {
                initPredictionChart({
                    labels: predictionChart.data.labels,
                    actual: predictionChart.data.datasets[0].data,
                    predicted: predictionChart.data.datasets[1].data
                });
            }
        });
    });
    
    // Event listeners for select elements
    cryptoSelect.addEventListener('change', fetchPredictionData);
    timeframeSelect.addEventListener('change', fetchPredictionData);
    modelSelect.addEventListener('change', fetchPredictionData);
    
    // Initial data fetch
    fetchPredictionData();

    // Refresh data every 5 minutes
    setInterval(fetchPredictionData, 5 * 60 * 1000);
});

// Update Key Factors section
function updateKeyFactors(factors) {
    const container = document.getElementById('key-factors');
    if (!factors || !container) return;

    container.innerHTML = factors.map(factor => `
        <div class="factor-item">
            <div class="factor-header">
                <span class="factor-name">${factor.name}</span>
                <span class="factor-value">${factor.value}</span>
            </div>
            <div class="factor-bar">
                <div class="factor-bar-fill" style="width: ${factor.impact * 100}%"></div>
            </div>
        </div>
    `).join('');
}

// Update Historical Predictions section
function updateHistoricalPredictions(predictions) {
    const container = document.getElementById('historical-predictions');
    if (!predictions || !container) return;

    container.innerHTML = predictions.map(pred => `
        <div class="prediction-item">
            <div class="prediction-header">
                <span class="prediction-date">${formatDate(pred.date)}</span>
                <span class="prediction-accuracy ${pred.accuracy >= 90 ? 'positive' : ''}">${pred.accuracy}%</span>
            </div>
            <div class="prediction-details">
                <span class="prediction-target">${pred.target}</span>
                <span class="prediction-result">${pred.result}</span>
            </div>
        </div>
    `).join('');
}

// Utility function to format dates
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Show error message when data fetch fails
function showErrorMessage() {
    const sections = ['key-factors', 'historical-predictions', 'technical-indicators', 'market-sentiment', 'risk-assessment'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Unable to load data. Please try again later.</p>
                </div>
            `;
        }
    });
} 