document.addEventListener('DOMContentLoaded', function() {
    // Fetch latest news
    async function fetchNews() {
        try {
            const response = await fetch('/api/latest-news');
            const news = await response.json();
            
            const newsContainer = document.getElementById('news-container');
            newsContainer.innerHTML = news.map(item => `
                <div class="news-card">
                    <div class="news-image">
                        <img src="${item.image}" alt="News Image" onerror="this.classList.add('error')">
                    </div>
                    <div class="news-content">
                        <div class="news-meta">
                            <span class="news-source">${item.source}</span>
                            <span class="news-date">${utils.formatDate(item.date)}</span>
                        </div>
                        <h3 class="news-title">${item.title}</h3>
                        <p class="news-summary">${item.summary}</p>
                        <div class="news-footer">
                            ${item.url ? `<a href="${item.url}" target="_blank" class="read-more">Read More <i class="fas fa-arrow-right"></i></a>` : ''}
                            <div class="news-sentiment ${item.sentiment >= 0 ? 'positive' : 'negative'}">
                                <i class="fas fa-${item.sentiment >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                                ${Math.abs(item.sentiment * 100).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error fetching news:', error);
            const newsContainer = document.getElementById('news-container');
            newsContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Unable to load news at this time. Please try again later.</p>
                </div>
            `;
        }
    }

    // Fetch and update crypto prices
    // async function fetchPrices() {
    //     try {
    //         const response = await fetch('/api/market-data');
    //         const data = await response.json();

    //         document.getElementById('btc-price').textContent = data.btc?.price ? `$${Number(data.btc.price).toLocaleString()}` : 'N/A';
    //         document.getElementById('eth-price').textContent = data.eth?.price ? `$${Number(data.eth.price).toLocaleString()}` : 'N/A';
    //         document.getElementById('ada-price').textContent = data.ada?.price ? `$${Number(data.ada.price).toLocaleString()}` : 'N/A';
    //     } catch (error) {
    //         document.getElementById('btc-price').textContent = 'N/A';
    //         document.getElementById('eth-price').textContent = 'N/A';
    //         document.getElementById('ada-price').textContent = 'N/A';
    //     }
    // }

    // Initial fetch
    fetchNews();
    // fetchPrices();
}); 