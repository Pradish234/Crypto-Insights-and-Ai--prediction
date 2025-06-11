from app import app, db
from models.auth_model import User
import argparse

def create_admin_user(email, password, username=None):
    with app.app_context():
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        
        if existing_user:
            # Update existing user to admin
            existing_user.is_admin = True
            existing_user.set_password(password)
            print("✅ Updated existing user to admin")
        else:
            # Create new admin user
            admin = User(
                username=username or email.split('@')[0],
                email=email,
                is_admin=True
            )
            admin.set_password(password)
            db.session.add(admin)
            print("✅ Created new admin user")
        
        db.session.commit()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create or update an admin user')
    parser.add_argument('email', help='Email address for the admin user')
    parser.add_argument('password', help='Password for the admin user')
    parser.add_argument('--username', help='Username for the admin user (optional)')
    
    args = parser.parse_args()
    create_admin_user(args.email, args.password, args.username) 