document.addEventListener('DOMContentLoaded', function () {
    let priceChart = null;
    let fetchInProgress = false;
    let latestTrends = null;
    let latestSymbol = '$';
    let latestCoinFilter = 'all';

    // On initial load, set the chart to the selected coin only
    let initialCoin = 'btc';
    const coinSelect = document.getElementById('coin-select');
    if (coinSelect) {
        initialCoin = coinSelect.value;
    }

    async function fetchMarketData() {
        if (fetchInProgress) return;
        fetchInProgress = true;

        // Show loading overlay
        const loadingOverlay = document.getElementById('market-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        const errorMessage = document.getElementById('market-error-message');
        if (errorMessage) errorMessage.style.display = 'none';

        try {
            // Fetch both current and historical data in parallel (no params)
            const [marketRes, trendsRes] = await Promise.all([
                fetch(`/api/market-data`),
                fetch(`/api/market-trends`)
            ]);
            const data = await marketRes.json();
            const trends = await trendsRes.json();

            console.log('Market Data API response:', data); // DEBUG LOG
            console.log('Market Trends API response:', trends); // DEBUG LOG

            if (data.error) throw new Error(data.error);
            if (trends.error) throw new Error(trends.error);

            const coins = ['btc', 'eth', 'ada'];
            const totalMarketCap = coins.reduce((sum, c) => sum + (data[c]?.market_cap || 0), 0);
            const totalVolume = coins.reduce((sum, c) => sum + (data[c]?.volume_24h || 0), 0);
            const activeCryptos = coins.filter(c => data[c]?.market_cap > 0).length;
            const btcDominance = totalMarketCap > 0 ? (data.btc.market_cap / totalMarketCap) * 100 : 0;
            const symbol = '$';
            document.getElementById('total-market-cap').textContent = utils.formatCurrency(totalMarketCap, symbol) + ' (Top 3)';
            document.getElementById('total-volume').textContent = utils.formatCurrency(totalVolume, symbol) + ' (Top 3)';
            document.getElementById('btc-dominance').textContent = utils.formatPercentage(btcDominance) + ' (Top 3)';
            document.getElementById('active-cryptos').textContent = activeCryptos;

            if (data.btc || data.eth || data.ada) {
                latestTrends = trends;
                latestSymbol = symbol;
                // Always use the current dropdown value
                const selectedCoin = coinSelect ? coinSelect.value : initialCoin;
                updatePriceChartWithTrends(trends, symbol, selectedCoin);
                updateCryptoTable(data, symbol);
                updateMarketInsights(data);
            } else {
                throw new Error('No market data available.');
            }

            if (errorMessage) errorMessage.style.display = 'none';
        } catch (error) {
            console.error("Fetch Error:", error);
            ['total-market-cap', 'total-volume', 'btc-dominance', 'active-cryptos'].forEach(id => {
                document.getElementById(id).textContent = '0';
            });
            if (errorMessage) {
                errorMessage.textContent = error.message || 'Failed to load market data.';
                errorMessage.style.display = 'block';
            }
        } finally {
            fetchInProgress = false;
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    function updatePriceChartWithTrends(trends, symbol, coinFilter = 'all') {
        const canvas = document.getElementById('priceChart');
        const ctx = canvas.getContext('2d');
        if (Chart.getChart(canvas)) {
            Chart.getChart(canvas).destroy();
        }
        // Prepare time labels (convert unix timestamp to readable date)
        const btcLabels = (trends.btc?.prices || []).map(p => new Date(p[0] * 1000));
        const ethLabels = (trends.eth?.prices || []).map(p => new Date(p[0] * 1000));
        const adaLabels = (trends.ada?.prices || []).map(p => new Date(p[0] * 1000));
        // Use the longest label set for the x-axis
        let labels = btcLabels;
        if (ethLabels.length > labels.length) labels = ethLabels;
        if (adaLabels.length > labels.length) labels = adaLabels;
        // Determine chart type
        const chartType = document.querySelector('.chart-type-btn.active')?.dataset.type || 'line';
        // Format labels for bar chart (YYYY-MM-DD)
        let formattedLabels = labels;
        if (chartType === 'bar') {
            formattedLabels = labels.map(date => {
                if (date instanceof Date && !isNaN(date)) {
                    return date.toISOString().slice(0, 10);
                }
                return date;
            });
        } else {
            formattedLabels = labels.map(date => {
                if (date instanceof Date && !isNaN(date)) {
                    return date.toLocaleString();
                }
                return date;
            });
        }
        // Build datasets based on filter and chart type
        let datasets = [];
        // Detect dark mode
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const fontColor = isDark ? '#f5f6fa' : '#222';
        // Bar chart specific options
        const barOptions = chartType === 'bar' ? {
            indexAxis: 'x',
            barPercentage: 0.8,
            categoryPercentage: 0.7
        } : {};
        if (chartType === 'bar') {
            if (coinFilter === 'all' || coinFilter === 'btc') {
                datasets.push({
                    label: 'Bitcoin (BTC)',
                    data: (trends.btc?.prices || []).map(p => p[1]),
                    borderColor: isDark ? '#FFD600' : '#F7931A',
                    backgroundColor: isDark ? 'rgba(255,214,0,0.85)' : 'rgba(247,147,26,0.5)',
                    borderWidth: isDark ? 2 : 1,
                    hidden: coinFilter !== 'all' && coinFilter !== 'btc'
                });
            }
            if (coinFilter === 'all' || coinFilter === 'eth') {
                datasets.push({
                    label: 'Ethereum (ETH)',
                    data: (trends.eth?.prices || []).map(p => p[1]),
                    borderColor: isDark ? '#82B1FF' : '#627EEA',
                    backgroundColor: isDark ? 'rgba(130,177,255,0.85)' : 'rgba(98,126,234,0.5)',
                    borderWidth: isDark ? 2 : 1,
                    hidden: coinFilter !== 'all' && coinFilter !== 'eth'
                });
            }
            if (coinFilter === 'all' || coinFilter === 'ada') {
                datasets.push({
                    label: 'Cardano (ADA)',
                    data: (trends.ada?.prices || []).map(p => p[1]),
                    borderColor: isDark ? '#40C4FF' : '#0033AD',
                    backgroundColor: isDark ? 'rgba(64,196,255,0.85)' : 'rgba(0,51,173,0.5)',
                    borderWidth: isDark ? 2 : 1,
                    hidden: coinFilter !== 'all' && coinFilter !== 'ada'
                });
            }
        } else { // line
            if (coinFilter === 'all' || coinFilter === 'btc') {
                datasets.push({
                    label: 'Bitcoin (BTC)',
                    data: (trends.btc?.prices || []).map(p => p[1]),
                    borderColor: '#F7931A',
                    backgroundColor: 'rgba(247,147,26,0.5)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    hidden: coinFilter !== 'all' && coinFilter !== 'btc'
                });
            }
            if (coinFilter === 'all' || coinFilter === 'eth') {
                datasets.push({
                    label: 'Ethereum (ETH)',
                    data: (trends.eth?.prices || []).map(p => p[1]),
                    borderColor: '#627EEA',
                    backgroundColor: 'rgba(98,126,234,0.5)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    hidden: coinFilter !== 'all' && coinFilter !== 'eth'
                });
            }
            if (coinFilter === 'all' || coinFilter === 'ada') {
                datasets.push({
                    label: 'Cardano (ADA)',
                    data: (trends.ada?.prices || []).map(p => p[1]),
                    borderColor: '#0033AD',
                    backgroundColor: 'rgba(0,51,173,0.5)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    hidden: coinFilter !== 'all' && coinFilter !== 'ada'
                });
            }
        }
        priceChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: formattedLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                ...barOptions,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: fontColor
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDark ? '#23272f' : '#fff',
                        titleColor: fontColor,
                        bodyColor: fontColor,
                        borderColor: isDark ? '#444' : '#ccc',
                        borderWidth: 1
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        display: true,
                        title: { display: true, text: 'Time', color: fontColor },
                        ticks: { maxTicksLimit: 10, color: fontColor },
                        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)' }
                    },
                    y: {
                        display: true,
                        title: { display: true, text: `Price (${symbol})`, color: fontColor },
                        beginAtZero: false,
                        ticks: { color: fontColor },
                        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)' }
                    }
                }
            }
        });
    }

    function updateCryptoTable(data, symbol) {
        const tbody = document.getElementById('cryptoTableBody');
        tbody.innerHTML = `
            <tr>
                <td>1</td>
                <td>Bitcoin (BTC)</td>
                <td>${utils.formatCurrency(data.btc?.price || 0, symbol)}</td>
                <td class="${(data.btc?.change_24h || 0) >= 0 ? 'positive' : 'negative'}">${utils.formatPercentage(data.btc?.change_24h || 0)}</td>
                <td>${utils.formatCurrency(data.btc?.market_cap || 0, symbol)}</td>
                <td>${utils.formatCurrency(data.btc?.volume_24h || 0, symbol)}</td>
            </tr>
            <tr>
                <td>2</td>
                <td>Ethereum (ETH)</td>
                <td>${utils.formatCurrency(data.eth?.price || 0, symbol)}</td>
                <td class="${(data.eth?.change_24h || 0) >= 0 ? 'positive' : 'negative'}">${utils.formatPercentage(data.eth?.change_24h || 0)}</td>
                <td>${utils.formatCurrency(data.eth?.market_cap || 0, symbol)}</td>
                <td>${utils.formatCurrency(data.eth?.volume_24h || 0, symbol)}</td>
            </tr>
            <tr>
                <td>3</td>
                <td>Cardano (ADA)</td>
                <td>${utils.formatCurrency(data.ada?.price || 0, symbol)}</td>
                <td class="${(data.ada?.change_24h || 0) >= 0 ? 'positive' : 'negative'}">${utils.formatPercentage(data.ada?.change_24h || 0)}</td>
                <td>${utils.formatCurrency(data.ada?.market_cap || 0, symbol)}</td>
                <td>${utils.formatCurrency(data.ada?.volume_24h || 0, symbol)}</td>
            </tr>
        `;
    }

    // Populate Market Insights section
    function updateMarketInsights(data) {
        const coins = [
            { key: 'btc', name: 'Bitcoin (BTC)' },
            { key: 'eth', name: 'Ethereum (ETH)' },
            { key: 'ada', name: 'Cardano (ADA)' }
        ];
        // Top Gainers: If all are negative/zero, show the least negative (closest to zero)
        let maxChange = Math.max(...coins.map(c => data[c.key]?.change_24h ?? -Infinity));
        let gainers = coins.filter(c => data[c.key]?.change_24h === maxChange);
        // Top Losers
        let minChange = Math.min(...coins.map(c => data[c.key]?.change_24h ?? Infinity));
        let losers = coins.filter(c => data[c.key]?.change_24h === minChange && minChange < 0);
        // Most Active
        let maxVolume = Math.max(...coins.map(c => data[c.key]?.volume_24h ?? -Infinity));
        let mostActive = coins.filter(c => data[c.key]?.volume_24h === maxVolume && maxVolume > 0);

        const gainersDiv = document.getElementById('top-gainers');
        const losersDiv = document.getElementById('top-losers');
        const activeDiv = document.getElementById('most-active');

        gainersDiv.innerHTML = gainers.length && maxChange !== -Infinity
            ? gainers.map(c => `<div>${c.name}: ${utils.formatPercentage(data[c.key].change_24h)}</div>`).join('')
            : '<div>N/A</div>';
        losersDiv.innerHTML = losers.length
            ? losers.map(c => `<div>${c.name}: ${utils.formatPercentage(data[c.key].change_24h)}</div>`).join('')
            : '<div>N/A</div>';
        activeDiv.innerHTML = mostActive.length
            ? mostActive.map(c => `<div>${c.name}: ${utils.formatCurrency(data[c.key].volume_24h, '$')}</div>`).join('')
            : '<div>N/A</div>';
    }

    // Remove filter event listeners
    // Only keep coin-select and chart controls
    document.getElementById('coin-select').addEventListener('change', function() {
        latestCoinFilter = this.value;
        if (latestTrends && latestSymbol) {
            updatePriceChartWithTrends(latestTrends, latestSymbol, latestCoinFilter);
        }
    });

    // Remove 'All Coins' option from chart dropdown and default to BTC
    if (coinSelect) {
        // Remove 'all' option if present
        Array.from(coinSelect.options).forEach(opt => {
            if (opt.value === 'all') coinSelect.removeChild(opt);
        });
        coinSelect.value = 'btc';
    }

    // Add event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Handle All Coins option for Bar chart
            const coinSelect = document.getElementById('coin-select');
            const allOption = Array.from(coinSelect.options).find(opt => opt.value === 'all');
            if (this.dataset.type === 'bar') {
                // If All Coins is selected, switch to BTC
                if (coinSelect.value === 'all') {
                    coinSelect.value = 'btc';
                    latestCoinFilter = 'btc';
                }
                // Hide All Coins option
                if (allOption) allOption.style.display = 'none';
            } else {
                // Show All Coins option
                if (allOption) allOption.style.display = '';
            }
            if (latestTrends && latestSymbol) {
                updatePriceChartWithTrends(latestTrends, latestSymbol, coinSelect.value);
            }
        });
    });

    fetchMarketData();
    setInterval(fetchMarketData, 30000);
});
