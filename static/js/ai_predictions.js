// Function to fetch and update predictions
async function updatePredictions() {
    try {
        const crypto = document.getElementById('crypto-select').value;
        const timeframe = document.getElementById('timeframe-select').value;
        const model = document.getElementById('model-select').value;
        
        // Show loading state
        document.getElementById('current-price').textContent = 'Loading...';
        document.getElementById('predicted-price').textContent = 'Loading...';
        document.getElementById('predicted-change').textContent = 'Loading...';
        document.getElementById('model-confidence').textContent = 'Loading...';
        document.getElementById('model-accuracy').textContent = 'Loading...';
        document.getElementById('model-rmse').textContent = 'Loading...';
        document.getElementById('model-mae').textContent = 'Loading...';
        
        const response = await fetch(`/api/predictions?crypto=${crypto}&timeframe=${timeframe}&model=${model}`);
        const data = await response.json();
        
        if (!response.ok || data.error) {
            throw new Error(data.error || 'No predictions available for the selected combination');
        }
        
        // Store the data globally
        chartData = data;
        
        // Update overview cards
        document.getElementById('current-price').textContent = data.current_price ? 
            `$${data.current_price.toFixed(2)}` : 'N/A';
        document.getElementById('predicted-price').textContent = data.predicted_price ? 
            `$${data.predicted_price.toFixed(2)}` : 'N/A';
        document.getElementById('predicted-change').textContent = data.predicted_change != null ? 
            `${data.predicted_change.toFixed(2)}%` : 'N/A';
        document.getElementById('model-confidence').textContent = data.model_confidence != null ? 
            `${(data.model_confidence * 100).toFixed(1)}%` : 'N/A';
        
        // Helper function for safe display
        function safeDisplay(value, isPercent = false, isCurrency = false) {
            if (value === null || value === undefined || value === 'N/A' || isNaN(Number(value))) return 'N/A';
            if (isPercent) return `${Number(value).toFixed(1)}%`;
            if (isCurrency) return `$${Number(value).toFixed(2)}`;
            return value;
        }

        // Update model metrics
        const accuracy = data.model_metrics?.accuracy;
        const rmse = data.model_metrics?.rmse;
        const mae = data.model_metrics?.mae;
        const modelPerfContainer = document.querySelector('.performance-metrics');
        if ((accuracy === 0 || accuracy === null || accuracy === undefined) &&
            (rmse === 0 || rmse === null || rmse === undefined) &&
            (mae === 0 || mae === null || mae === undefined)) {
            modelPerfContainer.innerHTML = '<div class="no-data">No model performance data available.</div>';
        } else {
            modelPerfContainer.innerHTML = `
                <div class="metric">
                    <span class="label">Accuracy</span>
                    <span class="value" id="model-accuracy">${safeDisplay(accuracy, true)}</span>
                </div>
                <div class="metric">
                    <span class="label">RMSE</span>
                    <span class="value" id="model-rmse">${safeDisplay(rmse, false, true)}</span>
                </div>
                <div class="metric">
                    <span class="label">MAE</span>
                    <span class="value" id="model-mae">${safeDisplay(mae, false, true)}</span>
                </div>
            `;
        }
        
        // Update chart
        if (window.predictionChart) {
            window.predictionChart.destroy();
        }
        
        // Only create chart if we have data
        if (data.chart_data?.labels?.length > 0) {
            const ctx = document.getElementById('predictionChart').getContext('2d');
            window.predictionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.chart_data.labels,
                    datasets: [{
                        label: 'Historical Price',
                        data: data.chart_data.historical,
                        borderColor: '#4CAF50',
                        fill: false
                    }, {
                        label: 'Predicted Price',
                        data: data.chart_data.predicted,
                        borderColor: '#2196F3',
                        borderDash: [5, 5],
                        fill: false
                    }]
                },
                    options: {
                        responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Price (USD)'
                            }
                        }
                    },
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: `${crypto} Price Prediction (${timeframe})`
                            }
                        }
                    }
                });
        } else {
            // Display message when no chart data is available
            const ctx = document.getElementById('predictionChart').getContext('2d');
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('No prediction data available for the selected combination', ctx.canvas.width/2, ctx.canvas.height/2);
        }
        
        // Hide any previous error message
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error updating predictions:', error);
        // Show error message to user
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = error.message || 'Failed to fetch predictions';
            errorMessage.style.display = 'block';
        }
        
        // Clear the chart
        if (window.predictionChart) {
            window.predictionChart.destroy();
            window.predictionChart = null;
        }
        
        // Show N/A for all metrics
        document.getElementById('current-price').textContent = 'N/A';
        document.getElementById('predicted-price').textContent = 'N/A';
        document.getElementById('predicted-change').textContent = 'N/A';
        document.getElementById('model-confidence').textContent = 'N/A';
        document.getElementById('model-accuracy').textContent = 'N/A';
        document.getElementById('model-rmse').textContent = 'N/A';
        document.getElementById('model-mae').textContent = 'N/A';
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    let currentChartType = 'line';
    let chartData = null;
    let predictionChart = null;
    
    // Register required Chart.js plugins
    if (typeof Chart !== 'undefined') {
        Chart.register({
            id: 'candlestick',
            beforeInit: function(chart) {
                chart.legend.options.labels.generateLabels = function() {
                    return [];
                };
            }
        });
    }
    
    function getThemeFontColor() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? '#f5f6fa' : '#222';
    }

    function isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function createLineChart(ctx, data) {
        const fontColor = getThemeFontColor();
        const dark = isDarkMode();
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.chart_data.labels,
                datasets: [{
                    label: 'Historical Price',
                    data: data.chart_data.historical,
                    borderColor: dark ? '#FFD600' : '#4CAF50',
                    backgroundColor: dark ? 'rgba(255,214,0,0.15)' : 'rgba(76, 175, 80, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }, {
                    label: 'Predicted Price',
                    data: data.chart_data.predicted,
                    borderColor: dark ? '#40C4FF' : '#2196F3',
                    backgroundColor: dark ? 'rgba(64,196,255,0.15)' : 'rgba(33, 150, 243, 0.1)',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: fontColor
                        }
                    },
                    title: {
                        display: true,
                        text: `${data.symbol} Price Prediction`,
                        color: fontColor
                    },
                    tooltip: {
                        bodyColor: fontColor,
                        titleColor: fontColor,
                        footerColor: fontColor
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: fontColor
                        },
                        ticks: {
                            color: fontColor
                        },
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(200,200,200,0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Price (USD)',
                            color: fontColor
                        },
                        ticks: {
                            color: fontColor
                        },
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(200,200,200,0.1)'
                        }
                    }
                }
            }
        });
    }
    
    // Function to create candlestick chart
    function createCandlestickChart(ctx, data) {
        const dark = isDarkMode();
        // Convert line data to candlestick format
        const candlestickData = data.chart_data.historical.map((price, index) => {
            const date = new Date(data.chart_data.labels[index]);
            const open = price * 0.99;
            const high = price * 1.01;
            const low = price * 0.98;
            const close = price;
            
            return {
                x: date.getTime(),
                o: open,
                h: high,
                l: low,
                c: close
            };
        });
        
        return new Chart(ctx, {
            type: 'candlestick',
            data: {
                datasets: [{
                    label: 'Price',
                    data: candlestickData,
                    color: {
                        up: dark ? '#FFD600' : '#4CAF50',
                        down: dark ? '#FF5252' : '#FF5252',
                        unchanged: dark ? '#b0b3b8' : '#999'
                    },
                    borderColor: dark ? '#FFD600' : '#4CAF50',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: getThemeFontColor()
                        }
                    },
                    tooltip: {
                        bodyColor: getThemeFontColor(),
                        titleColor: getThemeFontColor(),
                        footerColor: getThemeFontColor()
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d'
                            }
                        },
                        ticks: {
                            color: getThemeFontColor()
                        },
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(200,200,200,0.1)'
                        }
                    },
                    y: {
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Price (USD)',
                            color: getThemeFontColor()
                        },
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(200,200,200,0.1)'
                        },
                        ticks: {
                            color: getThemeFontColor()
                        }
                    }
                }
            }
        });
    }
    
    // Function to update chart based on type
    function updateChartType(type, data) {
        const canvas = document.getElementById('predictionChart');
        const ctx = canvas.getContext('2d');
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Destroy existing chart if it exists
        if (predictionChart) {
            predictionChart.destroy();
            predictionChart = null;
        }
        
        try {
            if (type === 'line') {
                predictionChart = createLineChart(ctx, data);
            } else if (type === 'candlestick') {
                predictionChart = createCandlestickChart(ctx, data);
            }
            currentChartType = type;
        } catch (error) {
            console.error('Error creating chart:', error);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Error creating chart', canvas.width/2, canvas.height/2);
        }
    }
    
    // Add event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.type;
            if (chartData) {
                document.querySelectorAll('.chart-type-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                updateChartType(type, chartData);
            }
        });
    });
    
    // Helper function for safe display
    function safeDisplay(value, isPercent = false, isCurrency = false) {
        if (value === null || value === undefined || value === 'N/A' || isNaN(Number(value))) return 'N/A';
        if (isPercent) return `${Number(value).toFixed(1)}%`;
        if (isCurrency) return `$${Number(value).toFixed(2)}`;
        return value;
    }
    
    // Function to update predictions
    async function updatePredictions() {
        try {
            const crypto = document.getElementById('crypto-select').value;
            const timeframe = document.getElementById('timeframe-select').value;
            const model = document.getElementById('model-select').value;
            
            // Show loading state
            document.getElementById('current-price').textContent = 'Loading...';
            document.getElementById('predicted-price').textContent = 'Loading...';
            document.getElementById('predicted-change').textContent = 'Loading...';
            document.getElementById('model-confidence').textContent = 'Loading...';
            document.getElementById('model-accuracy').textContent = 'Loading...';
            document.getElementById('model-rmse').textContent = 'Loading...';
            document.getElementById('model-mae').textContent = 'Loading...';
            
            const response = await fetch(`/api/predictions?crypto=${crypto}&timeframe=${timeframe}&model=${model}`);
            const data = await response.json();
            
            if (!response.ok || data.error) {
                throw new Error(data.error || 'No predictions available');
            }
            
            // Store the data globally
            chartData = {
                ...data,
                symbol: crypto,
                timeframe: timeframe
            };
            
            // Update metrics
            document.getElementById('current-price').textContent = safeDisplay(data.current_price, false, true);
            document.getElementById('predicted-price').textContent = safeDisplay(data.predicted_price, false, true);
            document.getElementById('predicted-change').textContent = safeDisplay(data.predicted_change, true);
            document.getElementById('model-confidence').textContent = safeDisplay(data.model_confidence * 100, true);
            document.getElementById('model-accuracy').textContent = safeDisplay(data.model_metrics?.accuracy, true);
            document.getElementById('model-rmse').textContent = safeDisplay(data.model_metrics?.rmse, false, true);
            document.getElementById('model-mae').textContent = safeDisplay(data.model_metrics?.mae, false, true);
            
            // Update chart
            if (data.chart_data?.labels?.length > 0) {
                updateChartType(currentChartType, chartData);
            } else {
                const ctx = document.getElementById('predictionChart').getContext('2d');
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText('No prediction data available', ctx.canvas.width/2, ctx.canvas.height/2);
            }
            
            // Hide error message if it exists
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error updating predictions:', error);
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.textContent = error.message || 'Failed to fetch predictions';
                errorMessage.style.display = 'block';
            }
            
            // Clear chart
            if (predictionChart) {
                predictionChart.destroy();
                predictionChart = null;
            }
            
            // Show N/A for all metrics
            document.getElementById('current-price').textContent = 'N/A';
            document.getElementById('predicted-price').textContent = 'N/A';
            document.getElementById('predicted-change').textContent = 'N/A';
            document.getElementById('model-confidence').textContent = 'N/A';
            document.getElementById('model-accuracy').textContent = 'N/A';
            document.getElementById('model-rmse').textContent = 'N/A';
            document.getElementById('model-mae').textContent = 'N/A';
        }
    }
    
    // Initialize
    updatePredictions();
    
    // Update when filters change
    document.getElementById('crypto-select').addEventListener('change', updatePredictions);
    document.getElementById('timeframe-select').addEventListener('change', updatePredictions);
    document.getElementById('model-select').addEventListener('change', updatePredictions);

    // Add event listeners for theme change to re-render chart with correct colors
    const observer = new MutationObserver(() => {
        if (window.predictionChart && chartData) {
            updateChartType(currentChartType, chartData);
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Update Key Factors section
    function updateKeyFactors(data) {
        const container = document.getElementById('key-factors');
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available.</div>';
            return;
        }
        container.innerHTML = data.map(factor => `
            <div class="factor-item">
                <span class="factor-name">${factor.name}</span>
                <span class="factor-value">${factor.value}</span>
            </div>
        `).join('');
    }

    // Update Historical Predictions section
    function updateHistoricalPredictions(data) {
        const container = document.getElementById('historical-predictions');
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available.</div>';
            return;
        }
        container.innerHTML = data.map(pred => `
            <div class="prediction-item">
                <span class="prediction-date">${pred.date}</span>
                <span class="prediction-value">${pred.value}</span>
            </div>
        `).join('');
    }

    // Update Technical Indicators section
    function updateTechnicalIndicators(data) {
        const container = document.getElementById('technical-indicators');
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available.</div>';
            return;
        }
        container.innerHTML = data.map(ind => `
            <div class="indicator-item">
                <span class="indicator-name">${ind.name}</span>
                <span class="indicator-value">${ind.value}</span>
            </div>
        `).join('');
    }

    // Update Market Sentiment section
    function updateMarketSentiment(data) {
        const container = document.getElementById('market-sentiment');
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available.</div>';
            return;
        }
        container.innerHTML = data.map(sent => `
            <div class="sentiment-item">
                <span class="sentiment-type">${sent.type}</span>
                <span class="sentiment-score">${sent.score}</span>
            </div>
        `).join('');
    }

    // Update Risk Assessment section
    function updateRiskAssessment(data) {
        const container = document.getElementById('risk-assessment');
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<div class="no-data">No data available.</div>';
            return;
        }
        container.innerHTML = data.map(risk => `
            <div class="risk-item">
                <span class="risk-type">${risk.type}</span>
                <span class="risk-score">${risk.score}</span>
            </div>
        `).join('');
    }
}); 