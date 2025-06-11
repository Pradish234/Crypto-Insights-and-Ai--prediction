from app import app, db
from models.auth_model import User
from models.market_model import MarketData
from models.sentiment_model import NewsData, SentimentAnalysis
from models.predictions_model import Prediction
from models.portfolio_model import Portfolio, PortfolioHolding, Transaction
from models.admin_model import SystemLog, SystemMetrics, MaintenanceMode
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta

def init_db():
    with app.app_context():
        # Drop all tables first
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        # Create admin user if not exists
        if not User.query.filter_by(email='admin@cryptoinsight.com').first():
            admin = User(
                username='admin',
                email='admin@cryptoinsight.com',
                is_admin=True,
                password_hash=generate_password_hash('admin123')
            )
            db.session.add(admin)
        
        # Seed market data
        now = datetime.utcnow()
        btc = MarketData(symbol="BTC", price=65000, market_cap=1200000000, volume_24h=500000, price_change_24h=2.5, high_24h=65500, low_24h=64000, timestamp=now)
        eth = MarketData(symbol="ETH", price=4000, market_cap=500000000, volume_24h=200000, price_change_24h=-1.2, high_24h=4100, low_24h=3900, timestamp=now)
        ada = MarketData(symbol="ADA", price=1.5, market_cap=48000000, volume_24h=800000, price_change_24h=0.7, high_24h=1.45, low_24h=1.40, timestamp=now)
        db.session.add_all([btc, eth, ada])

        # Seed dummy news articles
        for i in range(5):
            news = NewsData(
                title=f"Crypto News {i+1}",
                summary="Sample news summary...",
                url="https://example.com",
                image_url="https://example.com/image.png",
                source="Example Source",
                published_at=now - timedelta(days=i),
                sentiment_score=0.5
            )
            db.session.add(news)

        # Seed dummy sentiment analysis
        btc_sentiment = SentimentAnalysis(
            symbol="BTC",
            source="twitter",
            sentiment_score=0.65,
            timestamp=now
        )
        db.session.add(btc_sentiment)

        # Seed dummy predictions
        prediction_24h = Prediction(
            symbol="BTC",
            prediction_horizon="24h",
            predicted_price=66000,
            confidence_score=0.92,
            timestamp=now
        )
        db.session.add(prediction_24h)

        # Seed dummy portfolio
        portfolio = Portfolio(
            user_id=1,
            total_value=30000,
            last_updated=now
        )
        db.session.add(portfolio)
        db.session.flush()  # Flush to get the portfolio ID

        # Add portfolio holdings
        btc_holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            symbol="BTC",
            quantity=0.5,
            average_buy_price=60000,
            current_value=32500,
            last_updated=now
        )
        db.session.add(btc_holding)

        # Add a sample transaction
        transaction = Transaction(
            portfolio_id=portfolio.id,
            symbol="BTC",
            transaction_type="BUY",
            quantity=0.5,
            price=60000,
            total_value=30000,
            timestamp=now
        )
        db.session.add(transaction)

        # Seed dummy admin system logs and metrics
        log = SystemLog(
            message="System initialized",
            level="INFO",
            timestamp=now
        )
        db.session.add(log)

        metrics = SystemMetrics(
            active_users=1,
            total_requests=100,
            average_response_time=0.5,
            error_rate=0.01,
            timestamp=now
        )
        db.session.add(metrics)

        maintenance = MaintenanceMode(
            is_active=False,
            message="All systems operational",
            start_time=now,
            end_time=now + timedelta(hours=1),
            updated_by=1,
            updated_at=now
        )
        db.session.add(maintenance)

        # Commit all changes
        db.session.commit()
        print("✅ Database initialized and seeded successfully!")

if __name__ == '__main__':
    init_db()
