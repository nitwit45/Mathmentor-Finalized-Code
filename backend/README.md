# Mathmentor Backend API

Django REST Framework backend API for the Mathmentor tutoring platform.

## Features

- User authentication (sign up/login) for Tutors, Students, and Parents
- Session-based authentication
- RESTful API endpoints using Django REST Framework
- Custom User model with role-based access
- PostgreSQL database support
- CORS configuration for frontend integration

## Prerequisites

- Python 3.8 or higher
- PostgreSQL database (remote VPS)
- pip (Python package manager)

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Update the following in `.env`:
- `SECRET_KEY` - Django secret key (generate a new one for production)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` - PostgreSQL connection details
- `CORS_ALLOWED_ORIGINS` - Frontend URL(s)
- Email configuration (see Environment Variables section below)

### 4. Run Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

### 6. Start Development Server

```bash
python manage.py runserver
```

The server will start on `http://localhost:8000` (or the port specified).

## API Endpoints

### Authentication

- `POST /api/auth/tutor/signup/` - Sign up as a tutor
- `POST /api/auth/student/signup/` - Sign up as a student
- `POST /api/auth/parent/signup/` - Sign up as a parent
- `POST /api/auth/login/` - Login (requires verified email)
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/profile/` - Get current user profile (protected)
- `POST /api/auth/verify-email/` - Verify email with 6-digit code
- `POST /api/auth/resend-verification/` - Resend verification code

### Admin

- `GET /admin/` - Django admin interface

## Request/Response Examples

### Sign Up (Tutor)

**Request:**
```json
POST /api/auth/tutor/signup/
{
  "email": "tutor@example.com",
  "password": "Password123",
  "password_confirm": "Password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tutor account created successfully",
  "data": {
    "id": 1,
    "email": "tutor@example.com",
    "role": "TUTOR",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Login

**Request:**
```json
POST /api/auth/login/
{
  "email": "tutor@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "email": "tutor@example.com",
    "role": "TUTOR",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Project Structure

```
backend/
├── manage.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── mathmentor/              # Django project directory
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
└── accounts/                # Authentication app
    ├── __init__.py
    ├── models.py            # User model
    ├── serializers.py      # DRF serializers
    ├── views.py            # API views
    ├── urls.py             # App URLs
    ├── admin.py
    ├── apps.py
    └── migrations/
```

## Database Setup

Make sure your PostgreSQL database is set up on your VPS:

1. Create database: `CREATE DATABASE mathmentor;`
2. Create user: `CREATE USER your_user WITH PASSWORD 'your_password';`
3. Grant privileges: `GRANT ALL PRIVILEGES ON DATABASE mathmentor TO your_user;`

Update the database connection details in your `.env` file.

## Environment Variables

- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (True/False)
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_HOST` - Database host (VPS IP or domain)
- `DB_PORT` - Database port (default: 5432)
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `SESSION_COOKIE_SECURE` - Use secure cookies (True/False)
- `SESSION_COOKIE_NAME` - Session cookie name

### Email Configuration

- `EMAIL_BACKEND` - Email backend (default: `django.core.mail.backends.console.EmailBackend` for development)
  - For production: `django.core.mail.backends.smtp.EmailBackend`
- `EMAIL_HOST` - SMTP server host (e.g., `smtp.gmail.com`)
- `EMAIL_PORT` - SMTP server port (default: `587`)
- `EMAIL_USE_TLS` - Use TLS encryption (default: `True`)
- `EMAIL_HOST_USER` - SMTP username/email address
- `EMAIL_HOST_PASSWORD` - SMTP password or app password
- `EMAIL_FROM_ADDRESS` - From email address (default: `noreply@mathmentor.com`)

**Note:** For development, the console backend will print emails to the console. For production, configure SMTP settings with your email provider.

## Development Commands

- `python manage.py runserver` - Start development server
- `python manage.py makemigrations` - Create migration files
- `python manage.py migrate` - Apply migrations
- `python manage.py createsuperuser` - Create admin user
- `python manage.py shell` - Open Django shell
- `python manage.py collectstatic` - Collect static files (production)

## Production Deployment

1. Set `DEBUG=False` in `.env`
2. Set `SECRET_KEY` to a secure random value
3. Update `ALLOWED_HOSTS` with your domain
4. Set `SESSION_COOKIE_SECURE=True` if using HTTPS
5. Configure static files serving
6. Use a production WSGI server (e.g., Gunicorn)
7. Set up reverse proxy (e.g., Nginx)
