#!/usr/bin/env python
"""
Setup script for Django Investigation Project
"""

import os
import sys
import subprocess

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print("✓ Success")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed: {e}")
        if e.stderr:
            print(f"Error: {e.stderr}")
        return False

def main():
    """Main setup function"""
    print("🕵️ RoroEnquête - Setup Script")
    print("=" * 50)
    
    # Check if virtual environment is active
    if not hasattr(sys, 'real_prefix') and sys.base_prefix == sys.prefix:
        print("⚠️  Warning: Virtual environment not detected. It's recommended to use one.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Setup cancelled.")
            return
    
    # Install requirements
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        return
    
    # Create .env file if it doesn't exist
    if not os.path.exists('.env'):
        print("\nCreating .env file...")
        try:
            with open('.env.example', 'r') as f:
                content = f.read()
            with open('.env', 'w') as f:
                f.write(content)
            print("✓ .env file created. Please edit it with your configuration.")
        except Exception as e:
            print(f"✗ Failed to create .env file: {e}")
            return
    else:
        print("\n✓ .env file already exists")
    
    # Run migrations
    if not run_command("python manage.py makemigrations", "Creating database migrations"):
        return
    
    if not run_command("python manage.py migrate", "Applying database migrations"):
        return
    
    # Create superuser
    print("\nDo you want to create a superuser account?")
    response = input("This will allow you to access the Django admin interface. (y/n): ")
    if response.lower() == 'y':
        if not run_command("python manage.py createsuperuser", "Creating superuser"):
            print("Superuser creation failed. You can create one later with: python manage.py createsuperuser")
    
    # Collect static files
    if not run_command("python manage.py collectstatic --noinput", "Collecting static files"):
        return
    
    print("\n" + "=" * 50)
    print("✅ Setup completed successfully!")
    print("\nNext steps:")
    print("1. Edit the .env file with your database configuration")
    print("2. Run the development server: python manage.py runserver")
    print("3. Access the application at: http://127.0.0.1:8000")
    print("4. Access the admin interface at: http://127.0.0.1:8000/admin")
    
    print("\n📚 Additional commands:")
    print("- Create a new investigation: Use the web interface")
    print("- Join an investigation: Enter the investigation code")
    print("- Export data: Use the export button in the interface")

if __name__ == '__main__':
    main()