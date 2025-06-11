from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

# Initialize Flask-SQLAlchemy
db = SQLAlchemy()

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info' 