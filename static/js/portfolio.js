// Global variable to store current timeframe
let currentTimeframe = '24h';

// Function to update timeframe and refresh data
function updateTimeframe(timeframe) {
    currentTimeframe = timeframe;
    // Update active state of timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.timeframe === timeframe) {
            btn.classList.add('active');
        }
    });
    // Refresh all data with new timeframe
    refreshData();
}

// Function to refresh all data
async function refreshData() {
    try {
        // Fetch market data
        const marketResponse = await fetch(`/api/market-data?timeframe=${currentTimeframe}`);
        const marketData = await marketResponse.json();
        updateMarketData(marketData);

        // Fetch predictions
        const predictionsResponse = await fetch(`/api/predictions?timeframe=${currentTimeframe}`);
        const predictions = await predictionsResponse.json();
        updatePredictions(predictions);

        // Update charts with new timeframe
        updateCharts();
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Function to update market data display
function updateMarketData(data) {
    for (const [symbol, info] of Object.entries(data)) {
        const card = document.querySelector(`#${symbol}-card`);
        if (card) {
            card.querySelector('.price').textContent = `$${info.price.toLocaleString()}`;
            card.querySelector('.change').textContent = `${info.change}%`;
            card.querySelector('.market-cap').textContent = `$${info.market_cap.toLocaleString()}`;
            card.querySelector('.volume').textContent = `$${info.volume.toLocaleString()}`;
        }
    }
}

// Function to update predictions display
function updatePredictions(predictions) {
    for (const [symbol, info] of Object.entries(predictions)) {
        const card = document.querySelector(`#${symbol}-prediction`);
        if (card && info.current) {
            card.querySelector('.predicted-price').textContent = `$${info.current.predicted_price.toLocaleString()}`;
            card.querySelector('.confidence').textContent = `${info.current.confidence}%`;
            card.querySelector('.accuracy').textContent = `${info.accuracy}%`;
        }
    }
}

// Function to update charts
function updateCharts() {
    // Update price history chart
    updatePriceChart();
    // Update portfolio performance chart
    updatePortfolioChart();
    // Update allocation chart
    updateAllocationChart();
}

// Add event listeners when document loads
document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers for timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            updateTimeframe(btn.dataset.timeframe);
        });
    });

    // Initial data load
    refreshData();

    // Set up auto-refresh every 5 minutes
    setInterval(refreshData, 300000);
}); 