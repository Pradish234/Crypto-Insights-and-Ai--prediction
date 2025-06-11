from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from extensions import db, login_manager
from flask_login import login_user, login_required, logout_user, current_user
from models.auth_model import User
from models.market_model import MarketData
from models.predictions_model import Prediction
from models.sentiment_model import SentimentAnalysis, NewsData
from models.portfolio_model import Portfolio
from models.admin_model import SystemLog, SystemMetrics, MaintenanceMode
import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timedelta
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from functools import wraps
from flask_caching import Cache
import time
from forms.auth_forms import LoginForm, SignupForm, RequestPasswordResetForm, ResetPasswordForm
from flask_mail import Mail, Message
from textblob import TextBlob
import logging

# Load environment variables from .env file
load_dotenv()

# Create Flask application
app = Flask(__name__)

# Configure application
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///crypto_insight.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Email configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '587'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

# Initialize Flask-Mail
mail = Mail(app)

# Push an application context
app.app_context().push()

# Initialize extensions with application context
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'login'

# API Configuration
COINMARKETCAP_API_KEY = os.getenv('COINMARKETCAP_API_KEY')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')

if not COINMARKETCAP_API_KEY:
    print("Warning: COINMARKETCAP_API_KEY not found in environment variables")
    print("Please set your CoinMarketCap API key in the .env file")
    print("You can get an API key from: https://coinmarketcap.com/api/")
    COINMARKETCAP_API_KEY = 'demo'  # Fallback to demo key for testing

if not NEWS_API_KEY:
    print("Warning: NEWS_API_KEY not found in environment variables")
    print("Please set your News API key in the .env file")
    NEWS_API_KEY = 'demo'  # Fallback to demo key for testing

# Security Headers
if not app.config.get('TESTING', False):  # Only enable Talisman if not in testing mode
    Talisman(app, 
        force_https=True,
        strict_transport_security=True,
        session_cookie_secure=True,
        content_security_policy={
            'default-src': "'self'",
            'script-src': ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
            'style-src': ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
            'img-src': ["'self'", 'data:', '*'],
            'connect-src': ["'self'", 'api.coinmarketcap.com', 'newsapi.org']
        }
    )

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour"]
)

# Cache configuration
cache = Cache(app, config={
    'CACHE_TYPE': 'simple',
    'CACHE_DEFAULT_TIMEOUT': 300  # 5 minutes
})

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def home():
    return render_template('home.html')

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != os.getenv('API_KEY'):
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

def public_endpoint(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if app.config.get('LOGIN_DISABLED', False):
            return f(*args, **kwargs)
        return f(*args, **kwargs)  # Always allow access to public endpoints
    return decorated_function

@app.route('/api/market-data')
@public_endpoint
@cache.cached(timeout=60)  # Cache for 1 minute
@limiter.limit("10 per minute")
def get_market_data():
    try:
        timeframe = request.args.get('timeframe', '24h')
        currency = request.args.get('currency', 'USD').upper()
        sort_by = request.args.get('sort', 'market_cap')

        # Fetch latest quotes
        response = requests.get(
            'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
            params={
                'symbol': 'BTC,ETH,ADA',
                'convert': currency
            },
            headers={
                'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
            }
        )

        # Fetch global stats
        global_response = requests.get(
            'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest',
            params={'convert': currency},
            headers={'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY}
        )

        # Fallback to demo data if error
        if response.status_code != 200 or global_response.status_code != 200:
            demo_data = {
                'btc': {
                    'price': 65000, 'change_24h': 2.5, 'market_cap': 1200000000,
                    'volume_24h': 500000, 'high_24h': 65500, 'low_24h': 64000
                },
                'eth': {
                    'price': 4000, 'change_24h': -1.2, 'market_cap': 500000000,
                    'volume_24h': 200000, 'high_24h': 4100, 'low_24h': 3900
                },
                'ada': {
                    'price': 1.5, 'change_24h': 0.7, 'market_cap': 48000000,
                    'volume_24h': 800000, 'high_24h': 1.45, 'low_24h': 1.40
                },
                'global': {
                    'total_market_cap': 1700000000000,
                    'total_volume_24h': 90000000000,
                    'btc_dominance': 45.0,
                    'active_cryptocurrencies': 9500
                }
            }
            return jsonify(demo_data)

        data = response.json()
        global_data = global_response.json()
        market_data = {}

        for symbol, coin_data in data['data'].items():
            quote = coin_data['quote'][currency]
            market_data[symbol.lower()] = {
                'price': quote['price'],
                'change_24h': quote['percent_change_24h'],
                'market_cap': quote['market_cap'],
                'volume_24h': quote['volume_24h'],
                'high_24h': quote['high_24h'],
                'low_24h': quote['low_24h']
            }

        # Add full global stats
        global_quote = global_data['data']['quote'][currency]
        market_data['global'] = {
            'total_market_cap': global_quote['total_market_cap'],
            'total_volume_24h': global_quote['total_volume_24h'],
            'btc_dominance': global_data['data']['btc_dominance'],
            'active_cryptocurrencies': global_data['data']['active_cryptocurrencies']
        }

        # Optional sorting (preserve global stats)
        if sort_by in ['price', 'market_cap', 'volume_24h']:
            sorted_data = dict(sorted(
                ((k, v) for k, v in market_data.items() if k != 'global'),
                key=lambda x: x[1].get(sort_by, 0),
                reverse=True
            ))
            sorted_data['global'] = market_data['global']  # Preserve full global
            market_data = sorted_data

        return jsonify(market_data)

    except Exception as e:
        app.logger.error(f"Error fetching market data: {str(e)}")
        demo_data = {
            'btc': {
                'price': 65000, 'change_24h': 2.5, 'market_cap': 1200000000,
                'volume_24h': 500000, 'high_24h': 65500, 'low_24h': 64000
            },
            'eth': {
                'price': 4000, 'change_24h': -1.2, 'market_cap': 500000000,
                'volume_24h': 200000, 'high_24h': 4100, 'low_24h': 3900
            },
            'ada': {
                'price': 1.5, 'change_24h': 0.7, 'market_cap': 48000000,
                'volume_24h': 800000, 'high_24h': 1.45, 'low_24h': 1.40
            },
            'global': {
                'total_market_cap': 1700000000000,
                'total_volume_24h': 90000000000,
                'btc_dominance': 45.0,
                'active_cryptocurrencies': 9500
            }
        }
        return jsonify(demo_data)

@app.route('/api/latest-news')
@public_endpoint
@cache.cached(timeout=300)  # Cache for 5 minutes
@limiter.limit("20 per minute")
def get_latest_news():
    try:
        # Fetch news from NewsAPI
        response = requests.get(
            'https://newsapi.org/v2/everything',
            params={
                'q': 'cryptocurrency OR bitcoin OR ethereum',
                'apiKey': NEWS_API_KEY,
                'sortBy': 'publishedAt',
                'language': 'en',
                'pageSize': 10  # Get 10 articles
            },
            timeout=5  # Add timeout to prevent hanging
        )
        
        # Log the response for debugging
        print(f"NewsAPI Response Status: {response.status_code}")
        
        data = response.json()
        if data.get('status') != 'ok':
            print(f"NewsAPI Error Response: {data}")
            return jsonify({'error': 'News service returned an error'}), 500
            
        articles = data.get('articles', [])
        if not articles:
            return jsonify([])  # Return empty list if no articles
        
        # Sentiment analysis helper
        def analyze_sentiment(text):
            if not text:
                return 0, 'Neutral'
            score = TextBlob(text).sentiment.polarity  # -1 to 1
            if score > 0.2:
                label = 'Positive'
            elif score < -0.2:
                label = 'Negative'
            else:
                label = 'Neutral'
            return score, label
        
        # Process and return news data
        news_data = []
        for article in articles:
            text = article.get('description') or article.get('title') or ''
            sentiment_score, sentiment_label = analyze_sentiment(text)
            if not sentiment_label:
                sentiment_label = 'Neutral'
            news_item = {
                'title': article.get('title', ''),
                'summary': article.get('description', ''),
                'url': article.get('url', ''),
                'image': article.get('urlToImage', ''),
                'source': article.get('source', {}).get('name', ''),
                'date': article.get('publishedAt', ''),
                'sentiment': sentiment_score,
                'sentiment_label': sentiment_label
            }
            news_data.append(news_item)
                
        return jsonify(news_data)
        
    except requests.exceptions.Timeout:
        print("NewsAPI request timed out")
        return jsonify({'error': 'News service request timed out'}), 504
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI request failed: {str(e)}")
        return jsonify({'error': 'Failed to connect to news service'}), 500
    except Exception as e:
        print(f"Unexpected error in news endpoint: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/api/market-trends')
def get_market_trends():
    try:
        timeframe = request.args.get('timeframe', '7d')
        end_time = datetime.utcnow()
        if timeframe == '24h':
            start_time = end_time - timedelta(hours=24)
        elif timeframe == '7d':
            start_time = end_time - timedelta(days=7)
        elif timeframe == '30d':
            start_time = end_time - timedelta(days=30)
        else:
            start_time = end_time - timedelta(days=7)

        coins = ['BTC', 'ETH', 'ADA']
        trends_data = {}

        for coin in coins:
            data = MarketData.query.filter(
                MarketData.symbol == coin,
                MarketData.timestamp.between(start_time, end_time)
            ).order_by(MarketData.timestamp.asc()).all()

            trends_data[coin.lower()] = {
                'prices': [[int(d.timestamp.timestamp()), d.price] for d in data],
                'market_caps': [[int(d.timestamp.timestamp()), d.market_cap] for d in data],
                'total_volumes': [[int(d.timestamp.timestamp()), d.volume_24h] for d in data]
            }

        return jsonify(trends_data)
    except Exception as e:
        app.logger.error(f"Error fetching market trends: {str(e)}")
        return jsonify({'error': 'Failed to fetch market trends'}), 500

@app.route('/api/predictions')
def get_predictions():
    try:
        crypto = request.args.get('crypto', 'BTC')
        timeframe = request.args.get('timeframe', '24h')
        model = request.args.get('model', 'lstm')
        
        # Get latest market data for current price
        current_price = MarketData.get_latest_price(crypto)
        if not current_price:
            return jsonify({
                'current_price': 0,
                'predicted_price': 0,
                'predicted_change': 0,
                'model_confidence': 0,
                'model_metrics': {
                    'accuracy': 0,
                    'rmse': 0,
                    'mae': 0
                },
                'chart_data': {
                    'labels': [],
                    'historical': [],
                    'predicted': []
                }
            })
            
        # Get latest prediction for the specific model and timeframe
        prediction = Prediction.get_latest_prediction(crypto, timeframe, model)
        if not prediction:
            # Return default values if no prediction exists
            return jsonify({
                'current_price': current_price,
                'predicted_price': current_price,
                'predicted_change': 0,
                'model_confidence': 0,
                'model_metrics': {
                    'accuracy': 0,
                    'rmse': 0,
                    'mae': 0
                },
                'chart_data': {
                    'labels': [],
                    'historical': [],
                    'predicted': []
                }
            })
            
        # Get historical predictions for the specific model
        historical = Prediction.get_prediction_history(crypto, timeframe, model)
        
        # Get model accuracy metrics
        accuracy_metrics = Prediction.get_model_accuracy(crypto, timeframe, model)
        
        # Calculate predicted change
        predicted_change = ((prediction.predicted_price - current_price) / current_price) * 100 if current_price > 0 else 0
        
        response_data = {
            'current_price': current_price,
            'predicted_price': prediction.predicted_price,
            'predicted_change': predicted_change,
            'model_confidence': prediction.confidence_score or 0,
            'model_metrics': {
                'accuracy': accuracy_metrics['accuracy'] if accuracy_metrics else 0,
                'rmse': accuracy_metrics['average_error'] if accuracy_metrics else 0,
                'mae': accuracy_metrics['average_error'] if accuracy_metrics else 0
            },
            'chart_data': {
                'labels': [p.timestamp.strftime('%Y-%m-%d %H:%M') for p in historical],
                'historical': [p.actual_price for p in historical if p.actual_price],
                'predicted': [p.predicted_price for p in historical]
            }
                }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in predictions API: {str(e)}")  # Add logging
        return jsonify({
            'current_price': 0,
            'predicted_price': 0,
            'predicted_change': 0,
            'model_confidence': 0,
            'model_metrics': {
                'accuracy': 0,
                'rmse': 0,
                'mae': 0
            },
            'chart_data': {
                'labels': [],
                'historical': [],
                'predicted': []
            }
        })

@app.route('/api/sentiment')
def get_sentiment():
    try:
        # Get parameters from request
        symbol = request.args.get('crypto', 'BTC')
        timeframe = request.args.get('timeframe', '24h')
        source = request.args.get('source', 'all')
        
        # Get aggregated sentiment data
        sentiment_data = SentimentAnalysis.get_aggregated_sentiment(symbol, timeframe)
        
        if not sentiment_data:
            return jsonify({
                'overall_sentiment': 0,
                'sentiment_change': 0,
                'mention_volume': 0,
                'sentiment_strength': '0%',
                'chart_data': {'labels': [], 'scores': []},
                'correlation_data': {'points': []},
                'source_breakdown': {},
                'emotion_analysis': {},
                'topic_analysis': [],
                'correlation_stats': {'coefficient': 0, 'lag_time': '0h', 'confidence': 0}
            })
        
        # Filter by source if specified
        if source != 'all':
            source_data = sentiment_data.get('source_analysis', {}).get(source, {})
            sentiment_score = source_data.get('average_sentiment', 0)
            mention_count = source_data.get('count', 0)
        else:
            sentiment_score = sentiment_data.get('average_sentiment', 0)
            mention_count = sentiment_data.get('total_samples', 0)
        
        # Calculate sentiment change (compare with previous period)
        prev_timeframe = {
            '24h': timedelta(hours=24),
            '7d': timedelta(days=7),
            '30d': timedelta(days=30)
        }.get(timeframe)
        
        if prev_timeframe:
            end_time = datetime.utcnow() - prev_timeframe
            start_time = end_time - prev_timeframe
            prev_data = SentimentAnalysis.query.filter(
                SentimentAnalysis.symbol == symbol,
                SentimentAnalysis.timestamp.between(start_time, end_time)
            ).all()
            
            if prev_data:
                prev_sentiment = sum(d.sentiment_score for d in prev_data) / len(prev_data)
                sentiment_change = ((sentiment_score - prev_sentiment) / abs(prev_sentiment)) * 100 if prev_sentiment != 0 else 0
            else:
                sentiment_change = 0
        else:
            sentiment_change = 0
        
        return jsonify({
            'overall_sentiment': sentiment_score,
            'sentiment_change': sentiment_change,
            'mention_volume': mention_count,
            'sentiment_strength': f"{abs(sentiment_score * 100):.1f}%",
            'chart_data': {
                'labels': [d.timestamp.isoformat() for d in sentiment_data.get('data', [])],
                'scores': [d.sentiment_score for d in sentiment_data.get('data', [])]
            },
            'source_breakdown': sentiment_data.get('source_analysis', {}),
            'emotion_analysis': sentiment_data.get('label_distribution', {}),
            'correlation_stats': {
                'coefficient': 0.7,  # Example value
                'lag_time': '2h',
                'confidence': 0.85
            }
        })
    except Exception as e:
        print(f"Error in get_sentiment: {str(e)}")  # Add logging
        return jsonify({'error': 'Failed to fetch sentiment data'}), 500

@app.route('/market-trends')
def market_trends():
    return render_template('market_trends.html')

@app.route('/ai-predictions')
def ai_predictions():
    return render_template('ai_predictions.html')

@app.route('/sentiment-analysis')
def sentiment_analysis():
    return render_template('sentiment_analysis.html')

@app.route('/portfolio')
@login_required
def portfolio():
    return render_template('portfolio.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            print(f"User logged in: {user.email}, is_admin: {user.is_admin}")  # Debug log
            if user.is_admin:
                print("Redirecting to admin dashboard")  # Debug log
                return redirect(url_for('admin'))
            next_page = request.args.get('next')
            print(f"Redirecting to: {next_page or 'home'}")  # Debug log
            return redirect(next_page or url_for('home'))
        flash('Invalid email or password', 'error')
    return render_template('login.html', form=form)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    form = SignupForm()
    if form.validate_on_submit():
        if User.query.filter_by(email=form.email.data).first():
            flash('Email already registered', 'error')
            return redirect(url_for('signup'))
        if User.query.filter_by(username=form.username.data).first():
            flash('Username already taken', 'error')
            return redirect(url_for('signup'))
        
        user = User(
            username=form.username.data,
            email=form.email.data
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        
        flash('Account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('signup.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))

@app.route('/admin', methods=['GET', 'POST'])
@login_required
def admin():
    print(f"Admin route accessed by: {current_user.email}, is_admin: {current_user.is_admin}")  # Debug log
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.')
        return redirect(url_for('home'))
    
    # Get admin dashboard data
    system_logs = SystemLog.query.order_by(SystemLog.timestamp.desc()).limit(10).all()
    system_metrics = SystemMetrics.query.order_by(SystemMetrics.timestamp.desc()).first()
    maintenance_status = MaintenanceMode.get_current_status()
    
    return render_template('admin.html', 
                         logs=system_logs, 
                         metrics=system_metrics, 
                         maintenance=maintenance_status)

@app.route('/toggle_maintenance', methods=['POST'])
@login_required
def toggle_maintenance():
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.')
        return redirect(url_for('home'))
    
    current_status = MaintenanceMode.get_current_status()
    new_status = not current_status
    
    # Update maintenance mode status
    maintenance = MaintenanceMode.query.first()
    if maintenance:
        maintenance.is_active = new_status
    else:
        maintenance = MaintenanceMode(is_active=new_status)
        db.session.add(maintenance)
    
    db.session.commit()
    
    # Log the change
    log = SystemLog(
        level='info',
        message=f'Maintenance mode {"enabled" if new_status else "disabled"} by admin'
    )
    db.session.add(log)
    db.session.commit()
    
    flash(f'Maintenance mode {"enabled" if new_status else "disabled"} successfully.')
    return redirect(url_for('admin'))

@app.route('/api/technical-analysis/<symbol>')
@public_endpoint
@cache.cached(timeout=300)
@limiter.limit("20 per minute")
def get_technical_analysis(symbol):
    try:
        # Get technical indicators
        indicators = MarketData.calculate_technical_indicators(symbol)
        if not indicators:
            return jsonify({'error': 'No data available'}), 404
            
        # Get market trend
        trend = MarketData.get_market_trend(symbol)
        
        return jsonify({
            'symbol': symbol,
            'technical_indicators': indicators,
            'market_trend': trend
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predictions/<symbol>')
@public_endpoint
@cache.cached(timeout=300)
@limiter.limit("20 per minute")
def get_coin_predictions(symbol):
    try:
        predictions = {}
        timeframes = ['24h', '7d', '30d']
        
        for timeframe in timeframes:
            prediction = Prediction.get_latest_prediction(symbol, timeframe)
            if prediction:
                predictions[timeframe] = prediction.to_dict()
                
                # Get model accuracy
                accuracy = Prediction.get_model_accuracy(symbol, timeframe)
                if accuracy:
                    predictions[timeframe]['accuracy'] = accuracy
        
        if not predictions:
            return jsonify({'error': 'No predictions available'}), 404
            
        return jsonify({
            'symbol': symbol,
            'predictions': predictions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sentiment/aggregated/<symbol>')
@public_endpoint
@cache.cached(timeout=300)
@limiter.limit("20 per minute")
def get_aggregated_sentiment(symbol):
    try:
        timeframes = ['24h', '7d', '30d']
        aggregated_data = {}
        
        for timeframe in timeframes:
            sentiment_data = SentimentAnalysis.get_aggregated_sentiment(symbol, timeframe)
            if sentiment_data:
                aggregated_data[timeframe] = sentiment_data
        
        if not aggregated_data:
            return jsonify({'error': 'No sentiment data available'}), 404
            
        return jsonify({
            'symbol': symbol,
            'aggregated_sentiment': aggregated_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Set up logging to a file for email errors
email_logger = logging.getLogger('email')
email_logger.setLevel(logging.ERROR)
email_handler = logging.FileHandler('email_errors.log')
email_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s'))
if not email_logger.hasHandlers():
    email_logger.addHandler(email_handler)

@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password_request():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    form = RequestPasswordResetForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            token = user.get_reset_password_token()
            reset_url = url_for('reset_password', token=token, _external=True)
            # Check for email config before sending
            required_config = [
                app.config.get('MAIL_SERVER'),
                app.config.get('MAIL_PORT'),
                app.config.get('MAIL_USERNAME'),
                app.config.get('MAIL_PASSWORD'),
                app.config.get('MAIL_DEFAULT_SENDER')
            ]
            if not all(required_config):
                flash('Email configuration is missing. Please contact support.', 'error')
                email_logger.error('Missing email configuration: %s', required_config)
                return redirect(url_for('login'))
            try:
                msg = Message('Password Reset Request',
                            recipients=[user.email])
                msg.body = f'''To reset your password, visit the following link:
{reset_url}

If you did not make this request, simply ignore this email and no changes will be made.
'''
                mail.send(msg)
                flash('Check your email for instructions to reset your password.', 'info')
            except Exception as e:
                flash('Error sending email. Please try again later.', 'error')
                email_logger.error(f"Error sending email to {user.email}: {str(e)}")
        else:
            # Don't reveal if email exists or not
            flash('Check your email for instructions to reset your password.', 'info')
        return redirect(url_for('login'))
    
    return render_template('reset_password.html', form=form, title='Reset Password')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    
    user = User.verify_reset_password_token(token)
    if not user:
        flash('Invalid or expired reset token', 'error')
        return redirect(url_for('reset_password_request'))
    
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        db.session.commit()
        flash('Your password has been reset.', 'success')
        return redirect(url_for('login'))
    
    return render_template('reset_password_confirm.html', form=form)

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/api/portfolio')
@login_required
@cache.cached(timeout=60)  # Cache for 1 minute
@limiter.limit("30 per minute")
def get_portfolio():
    try:
        # Get user's portfolio data
        portfolio = Portfolio.query.filter_by(user_id=current_user.id).first()
        if not portfolio:
            return jsonify({
                'holdings': [],
                'total_value': 0,
                'total_profit_loss': 0,
                'allocation': {
                    'labels': [],
                    'values': []
                }
            })

        # Get current prices for calculations
        holdings = portfolio.get_holdings()
        total_value = 0
        total_cost = 0
        allocation_data = {
            'labels': [],
            'values': []
        }

        # Calculate portfolio metrics
        for holding in holdings:
            current_price = MarketData.get_latest_price(holding['symbol'])
            holding['current_value'] = holding['quantity'] * current_price
            holding['profit_loss'] = holding['current_value'] - holding['cost_basis']
            holding['profit_loss_percentage'] = (holding['profit_loss'] / holding['cost_basis']) * 100 if holding['cost_basis'] > 0 else 0
            
            total_value += holding['current_value']
            total_cost += holding['cost_basis']

            # Add to allocation data
            allocation_data['labels'].append(holding['symbol'])
            allocation_data['values'].append(holding['current_value'])

        total_profit_loss = total_value - total_cost
        total_profit_loss_percentage = (total_profit_loss / total_cost) * 100 if total_cost > 0 else 0

        return jsonify({
            'holdings': holdings,
            'total_value': total_value,
            'total_profit_loss': total_profit_loss,
            'total_profit_loss_percentage': total_profit_loss_percentage,
            'allocation': allocation_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predictions/debug')
def debug_predictions():
    """Debug endpoint to check prediction data availability"""
    # Only allow access in development mode
    if not app.debug:
        return jsonify({'error': 'Debug endpoint only available in development mode'}), 403
        
    try:
        # Get prediction statistics
        stats = Prediction.get_prediction_stats()
        if not stats:
            return jsonify({'error': 'Failed to get prediction statistics'}), 500
            
        return jsonify(stats)
        
    except Exception as e:
        print(f"Error in predictions debug API: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Background task for updating cache
def update_cache():
    while True:
        with app.app_context():
            try:
                # Directly fetch and process market data
                headers = {
                    'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
                    'Accept': 'application/json'
                }
                response = requests.get(
                    'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
                    headers=headers,
                    params={'symbol': 'BTC,ETH,ADA'}
                )
                
                if response.status_code != 200:
                    print(f"Error fetching market data: HTTP {response.status_code}")
                    time.sleep(60)
                    continue
                    
                data = response.json()
                
                if 'data' not in data:
                    print("Error: Invalid API response format")
                    time.sleep(60)
                    continue
                
                # Store data in database first
                for symbol in ['BTC', 'ETH', 'ADA']:
                    if symbol in data['data']:
                        coin_data = data['data'][symbol]['quote']['USD']
                        market_data = MarketData(
                            symbol=symbol,
                            price=coin_data['price'],
                            market_cap=coin_data['market_cap'],
                            volume_24h=coin_data['volume_24h'],
                            price_change_24h=coin_data['percent_change_24h'],
                            high_24h=coin_data['price'],  # We don't get high/low from this API
                            low_24h=coin_data['price'],   # We don't get high/low from this API
                            timestamp=datetime.utcnow()
                        )
                        db.session.add(market_data)
                
                db.session.commit()
                
                # Only after successful database update, update the cache
                market_data = {
                    'btc': {
                        'price': data['data']['BTC']['quote']['USD']['price'],
                        'change_24h': data['data']['BTC']['quote']['USD']['percent_change_24h'],
                        'market_cap': data['data']['BTC']['quote']['USD']['market_cap'],
                        'volume_24h': data['data']['BTC']['quote']['USD']['volume_24h']
                    },
                    'eth': {
                        'price': data['data']['ETH']['quote']['USD']['price'],
                        'change_24h': data['data']['ETH']['quote']['USD']['percent_change_24h'],
                        'market_cap': data['data']['ETH']['quote']['USD']['market_cap'],
                        'volume_24h': data['data']['ETH']['quote']['USD']['volume_24h']
                    },
                    'ada': {
                        'price': data['data']['ADA']['quote']['USD']['price'],
                        'change_24h': data['data']['ADA']['quote']['USD']['percent_change_24h'],
                        'market_cap': data['data']['ADA']['quote']['USD']['market_cap'],
                        'volume_24h': data['data']['ADA']['quote']['USD']['volume_24h']
                    }
                }
                
                # Delete old cache and set new cache atomically
                cache.delete('view//api/market-data')
                cache.set('view//api/market-data', market_data, timeout=60)
                
            except requests.exceptions.RequestException as e:
                print(f"Network error updating cache: {str(e)}")
            except Exception as e:
                print(f"Error updating cache: {str(e)}")
            
        time.sleep(60)  # Update every minute

# Start background thread
import threading
cache_thread = threading.Thread(target=update_cache, daemon=True)
cache_thread.start()

@app.before_request
def check_maintenance():
    # Skip maintenance check for static files and admin routes
    if request.path.startswith('/static') or request.path in ['/login', '/admin', '/toggle_maintenance']:
        return
    
    # Check if maintenance mode is active
    if MaintenanceMode.get_current_status():
        # Allow admin users to access the site
        if not current_user.is_authenticated or not current_user.is_admin:
            return render_template('maintenance.html'), 503

if __name__ == '__main__':
    db.create_all()  # Create tables within app context
    app.run(debug=True) 
