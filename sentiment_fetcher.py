import os
import requests
from datetime import datetime, timedelta
from textblob import TextBlob
from app import app, db
from models.sentiment_model import SentimentAnalysis

NEWS_API_KEY = os.getenv('NEWS_API_KEY')
CRYPTO_SYMBOLS = ['BTC', 'ETH', 'ADA']

# Helper to analyze sentiment
def analyze_sentiment(text):
    if not text:
        return 0.0, 'Neutral', 1.0
    score = TextBlob(text).sentiment.polarity
    if score > 0.2:
        label = 'Positive'
    elif score < -0.2:
        label = 'Negative'
    else:
        label = 'Neutral'
    return score, label, 1.0

with app.app_context():
    now = datetime.utcnow()
    since = now - timedelta(hours=24)
    for symbol in CRYPTO_SYMBOLS:
        print(f'Fetching news for {symbol}...')
        response = requests.get(
            'https://newsapi.org/v2/everything',
            params={
                'q': symbol,
                'apiKey': NEWS_API_KEY,
                'sortBy': 'publishedAt',
                'language': 'en',
                'pageSize': 10
            },
            timeout=10
        )
        data = response.json()
        articles = data.get('articles', [])
        added_count = 0
        for article in articles:
            published_at = datetime.strptime(article['publishedAt'], '%Y-%m-%dT%H:%M:%SZ')
            if published_at < since or published_at > now:
                continue  # Only add articles from the last 24 hours
            text = article.get('description') or article.get('title') or ''
            score, label, confidence = analyze_sentiment(text)
            sentiment = SentimentAnalysis(
                symbol=symbol,
                sentiment_score=score,
                sentiment_label=label,
                source='News',
                timestamp=published_at,
                text_analyzed=text,
                confidence=confidence
            )
            db.session.add(sentiment)
            added_count += 1
        db.session.commit()
        print(f'Added {added_count} sentiment records for {symbol}.')
print('Done!') 