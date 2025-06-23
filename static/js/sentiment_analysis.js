document.addEventListener('DOMContentLoaded', function() {
    let sentimentChart = null;
    let correlationChart = null;
    const cryptoSelect = document.getElementById('crypto-select');
    const timeframeSelect = document.getElementById('timeframe-select');
    const sourceSelect = document.getElementById('source-select');
    
    // Initialize sentiment chart
    function getThemeFontColor() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? '#f5f6fa' : '#222';
    }

    function isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function initSentimentChart(data) {
        if (sentimentChart) {
            sentimentChart.destroy();
        }
        const chartType = document.querySelector('.chart-type-btn.active').dataset.type;
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        const fontColor = getThemeFontColor();
        const dark = isDarkMode();
        sentimentChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Sentiment Score',
                    data: data.scores,
                    borderColor: dark ? '#FFD600' : '#3498db',
                    backgroundColor: chartType === 'bar' ? (dark ? '#FFD600' : '#3498db') : (dark ? 'rgba(255,214,0,0.15)' : 'rgba(52, 152, 219, 0.1)'),
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                        labels: {
                            color: fontColor
                        }
                    },
                    title: {
                        display: true,
                        text: 'Sentiment Trend',
                        color: fontColor
                    },
                    tooltip: {
                        bodyColor: fontColor,
                        titleColor: fontColor,
                        footerColor: fontColor
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: fontColor
                        },
                        title: {
                            display: true,
                            text: 'Sentiment Score',
                            color: fontColor
                        }
                    },
                    x: {
                        grid: {
                            color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: fontColor
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: fontColor
                        }
                    }
                }
            }
        });
    }
    
    // Utility functions
    const utils = {
        formatPercentage: (value) => `${(value * 100).toFixed(2)}%`,
        formatNumber: (value) => value.toLocaleString(),
        formatDate: (date) => new Date(date).toLocaleDateString(),
        formatSentiment: (value) => `${(value * 100).toFixed(2)}%`
    };
    
    function updateTopicAnalysis(topics) {
        const container = document.getElementById('topic-analysis');
        if (!container || !topics || !topics.length) return;
        
        const topicsList = topics.map(topic => `
            <div class="topic-item">
                <div class="topic-header">
                    <span class="topic-name">${topic.name}</span>
                    <span class="topic-score ${topic.sentiment >= 0 ? 'positive' : 'negative'}">
                        ${utils.formatPercentage(topic.sentiment)}
                    </span>
                </div>
                <div class="topic-stats">
                    <span class="topic-volume">${topic.volume.toLocaleString()} mentions</span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = topicsList;
    }
    
    async function fetchSentimentData() {
        // Add loading state
        document.querySelectorAll('.breakdown-card').forEach(card => card.classList.add('loading'));
        
        try {
            const crypto = cryptoSelect.value;
            const timeframe = timeframeSelect.value;
            const source = sourceSelect.value;
            
            const response = await fetch(`/api/sentiment?crypto=${crypto}&timeframe=${timeframe}&source=${source}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Initialize or update sentiment chart
            const chartData = {
                labels: data.chart_data.labels,
                scores: data.chart_data.scores
            };
            
            initSentimentChart(chartData);
            
            // Update overview cards
            document.getElementById('overall-sentiment').textContent = utils.formatPercentage(data.overall_sentiment);
            document.getElementById('overall-sentiment').className = `value ${data.overall_sentiment >= 0 ? 'positive' : 'negative'}`;
            
            document.getElementById('sentiment-change').textContent = utils.formatPercentage(data.sentiment_change);
            document.getElementById('sentiment-change').className = `value ${data.sentiment_change >= 0 ? 'positive' : 'negative'}`;
            
            document.getElementById('mention-volume').textContent = utils.formatNumber(data.mention_volume);
            document.getElementById('sentiment-strength').textContent = data.sentiment_strength;
            
            // Update source breakdown
            updateSourceBreakdown(data.source_breakdown);
            
            // Update emotion analysis
            updateEmotionAnalysis(data.emotion_analysis);
            
            // Update topic analysis
            updateTopicAnalysis(data.topic_analysis);
            
            // Update correlation stats
            document.getElementById('correlation-coefficient').textContent = data.correlation_stats.coefficient.toFixed(2);
            document.getElementById('lag-time').textContent = data.correlation_stats.lag_time;
            document.getElementById('confidence-level').textContent = utils.formatPercentage(data.correlation_stats.confidence);
            
        } catch (error) {
            console.error('Error fetching sentiment data:', error);
            // Show error message to user
            document.querySelectorAll('.breakdown-card').forEach(card => {
                card.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Unable to load data. Please try again later.</p>
                    </div>
                `;
            });
        } finally {
            // Remove loading state
            document.querySelectorAll('.breakdown-card').forEach(card => card.classList.remove('loading'));
        }
    }
    
    function updateSourceBreakdown(breakdown) {
        const container = document.getElementById('source-breakdown');
        if (!container) return;
        
        const sourcesList = Object.entries(breakdown).map(([source, data]) => {
            const mentionText = data.count === 1 ? 'mention' : 'mentions';
            return `
                <div class="source-item">
                    <div class="source-header">
                        <span class="source-name">${source.charAt(0).toUpperCase() + source.slice(1)}</span>
                        <span class="source-score ${data.average_sentiment >= 0 ? 'positive' : 'negative'}">
                            ${utils.formatPercentage(data.average_sentiment)}
                        </span>
                    </div>
                    <div class="source-stats">
                        <span class="volume">${data.count.toLocaleString()} ${mentionText}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = sourcesList || '<div class="no-data">No source data available</div>';
    }
    
    function updateEmotionAnalysis(emotions) {
        const container = document.getElementById('emotion-analysis');
        if (!container) return;
        
        if (!emotions || Object.keys(emotions).length === 0) {
            container.innerHTML = '<div class="no-data">No emotion data available</div>';
            return;
        }
        
        const total = Object.values(emotions).reduce((a, b) => a + b, 0);
        const emotionsList = Object.entries(emotions).map(([emotion, count]) => {
            const percentage = (count / total) * 100;
            return `
                <div class="emotion-item">
                    <div class="emotion-header">
                        <span class="emotion-name">${emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
                        <span class="emotion-score">${percentage.toFixed(1)}%</span>
                    </div>
                    <div class="emotion-bar">
                        <div class="bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = emotionsList;
    }
    
    // Event listeners
    cryptoSelect.addEventListener('change', fetchSentimentData);
    timeframeSelect.addEventListener('change', fetchSentimentData);
    sourceSelect.addEventListener('change', fetchSentimentData);
    
    // Add event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('.chart-type-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to clicked button
            this.classList.add('active');
            
            // Reinitialize chart with current data
            if (sentimentChart && sentimentChart.data) {
                initSentimentChart({
                    labels: sentimentChart.data.labels,
                    scores: sentimentChart.data.datasets[0].data
                });
            }
        });
    });

    // Add event listeners for theme change to re-render chart with correct colors
    const observer = new MutationObserver(() => {
        if (sentimentChart && sentimentChart.data) {
            initSentimentChart({
                labels: sentimentChart.data.labels,
                scores: sentimentChart.data.datasets[0].data
            });
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Initial data fetch
    fetchSentimentData();
}); 