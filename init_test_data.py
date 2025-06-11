from app import app
from extensions import db
from models.predictions_model import Prediction
from models.sentiment_model import SentimentAnalysis
from datetime import datetime, timedelta
import random

def create_test_sentiment_data():
    with app.app_context():
        # Clear existing sentiment data
        SentimentAnalysis.query.delete()
        db.session.commit()
        
        # Test data parameters
        symbols = ['BTC', 'ETH', 'ADA']
        sources = ['twitter', 'reddit', 'news', 'telegram']
        
        # Generate sentiment data for the last 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        for symbol in symbols:
            current_date = start_date
            while current_date <= end_date:
                # Ensure one of each sentiment per day per source
                for label, score in [('Positive', 0.7), ('Neutral', 0.0), ('Negative', -0.7)]:
                    for source in sources:
                        sentiment = SentimentAnalysis(
                            symbol=symbol,
                            sentiment_score=score + random.uniform(-0.1, 0.1),
                            sentiment_label=label,
                            source=source,
                            timestamp=current_date + timedelta(hours=random.randint(0, 23)),
                            text_analyzed=f"Sample {label.lower()} sentiment for {symbol} from {source}",
                            confidence=random.uniform(0.7, 0.95)
                        )
                        db.session.add(sentiment)
                current_date += timedelta(days=1)
        db.session.commit()
        print("Test sentiment data generated successfully!")

def create_test_predictions():
    with app.app_context():
        # Clear existing predictions
        Prediction.query.delete()
        db.session.commit()
        
        # Test data parameters
        symbols = ['BTC', 'ETH', 'ADA']
        models = ['lstm', 'prophet', 'xgboost', 'ensemble']
        timeframes = ['24h', '7d', '30d']
        base_prices = {'BTC': 65000, 'ETH': 3500, 'ADA': 1.2}
        
        # Model-specific prediction characteristics
        model_characteristics = {
            'lstm': {
                '24h': {'max_variation': 0.03, 'min_confidence': 0.75},  # ±3% variation, higher confidence
                '7d': {'max_variation': 0.08, 'min_confidence': 0.65},   # ±8% variation
                '30d': {'max_variation': 0.15, 'min_confidence': 0.55}   # ±15% variation
            },
            'prophet': {
                '24h': {'max_variation': 0.04, 'min_confidence': 0.70},  # ±4% variation
                '7d': {'max_variation': 0.10, 'min_confidence': 0.60},   # ±10% variation
                '30d': {'max_variation': 0.20, 'min_confidence': 0.50}   # ±20% variation
            },
            'xgboost': {
                '24h': {'max_variation': 0.025, 'min_confidence': 0.80}, # ±2.5% variation, highest confidence
                '7d': {'max_variation': 0.07, 'min_confidence': 0.70},   # ±7% variation
                '30d': {'max_variation': 0.12, 'min_confidence': 0.60}   # ±12% variation
            },
            'ensemble': {
                '24h': {'max_variation': 0.02, 'min_confidence': 0.85},  # ±2% variation, most stable
                '7d': {'max_variation': 0.06, 'min_confidence': 0.75},   # ±6% variation
                '30d': {'max_variation': 0.10, 'min_confidence': 0.65}   # ±10% variation
            }
        }
        
        # Generate predictions for the last 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        for symbol in symbols:
            current_price = base_prices[symbol]
            
            for model in models:
                for timeframe in timeframes:
                    # Get model-specific characteristics for this timeframe
                    model_props = model_characteristics[model][timeframe]
                    
                    # Calculate timeframe multiplier for price variation
                    timeframe_multiplier = {
                        '24h': 1,
                        '7d': 2,
                        '30d': 3
                    }[timeframe]
                    
                    # Generate predictions for each day
                    current_date = start_date
                    while current_date <= end_date:
                        # Add small random walk to current price
                        price_drift = random.uniform(-0.005, 0.005)  # ±0.5% daily drift
                        current_price = current_price * (1 + price_drift)
                        
                        # Generate prediction with model-specific characteristics
                        max_variation = model_props['max_variation'] * timeframe_multiplier
                        predicted_variation = random.uniform(-max_variation, max_variation)
                        predicted_price = current_price * (1 + predicted_variation)
                        
                        # Higher confidence for shorter timeframes
                        confidence_base = model_props['min_confidence']
                        confidence_score = confidence_base * (1 / timeframe_multiplier)
                        confidence_score = min(0.95, max(0.6, confidence_score))  # Keep between 0.6 and 0.95
                        
                        # Set actual_price and prediction_error for all predictions (including the latest)
                        prediction = Prediction(
                            symbol=symbol,
                            predicted_price=predicted_price,
                            confidence_score=confidence_score,
                            prediction_horizon=timeframe,
                            timestamp=current_date,
                            model_version=model,
                            actual_price=current_price,
                            prediction_error=abs(predicted_price - current_price),
                            market_conditions={
                                'volume': random.uniform(1000000, 5000000),
                                'market_cap': random.uniform(100000000, 500000000),
                                'volatility': random.uniform(0.01, 0.05)
                            }
                        )
                        db.session.add(prediction)
                        
                        current_date += timedelta(days=1)
        
        db.session.commit()
        print("Test predictions generated successfully!")

if __name__ == '__main__':
    create_test_predictions() 
    create_test_sentiment_data() 