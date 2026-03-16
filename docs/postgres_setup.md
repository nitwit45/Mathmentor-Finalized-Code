# PostgreSQL Setup Guide for Mathmentor Backend

This guide will help you set up PostgreSQL on your Debian VPS for the Mathmentor backend.

## Prerequisites

- Debian-based VPS with sudo access
- PostgreSQL installed (if not installed, run: `sudo apt install postgresql postgresql-contrib`)

## Step 1: Create Database and User

1. Switch to the postgres user and open PostgreSQL prompt:

```bash
sudo -u postgres psql
```

2. Inside the PostgreSQL prompt, run the following commands:

```sql
-- Create the database
CREATE DATABASE mathmentor;

-- Create a user with password
CREATE USER mathmentor_user WITH PASSWORD 'your_secure_password_here';

-- Grant privileges on the database
GRANT ALL PRIVILEGES ON DATABASE mathmentor TO mathmentor_user;

-- Connect to the mathmentor database
\c mathmentor

-- Grant schema privileges (important for Django migrations, run one at a time)
GRANT ALL ON SCHEMA public TO mathmentor_user;
ALTER SCHEMA public OWNER TO mathmentor_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mathmentor_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mathmentor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mathmentor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mathmentor_user;
GRANT CREATE ON SCHEMA public TO mathmentor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT CREATE ON TABLES TO mathmentor_user;

-- Exit PostgreSQL
\q
```

**Important:** Replace `'your_secure_password_here'` with a strong password. You'll need this password for your `.env` file.

## Step 2: Configure PostgreSQL for Remote Access

### 2.1 Find Your PostgreSQL Version

```bash
sudo -u postgres psql -c "SELECT version();"
```

### 2.2 Configure PostgreSQL to Listen on All Interfaces

Edit the PostgreSQL configuration file:

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Find and modify the `listen_addresses` line:

```conf
# Change from:
#listen_addresses = 'localhost'

# To this (allows connections from any IP):
listen_addresses = '*'
```

Save and exit (Ctrl+X, then Y, then Enter).

### 2.3 Configure Client Authentication

Edit the `pg_hba.conf` file:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Add one of the following lines at the end of the file:

**Option 1: Allow from specific IP (Recommended for production)**

```conf
host    mathmentor    mathmentor_user    YOUR_LOCAL_IP/32    md5
```

Replace `YOUR_LOCAL_IP` with your development machine's IP address.

**Option 2: Allow from any IP (Development only - less secure)**

```conf
host    mathmentor    mathmentor_user    0.0.0.0/0    md5
```

Save and exit.

### 2.4 Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

## Step 3: Configure Firewall

Allow PostgreSQL connections through your firewall:

```bash
# Allow PostgreSQL port (5432)
sudo ufw allow 5432/tcp

# Or allow only from your specific IP
sudo ufw allow from YOUR_LOCAL_IP to any port 5432

# Check firewall status
sudo ufw status
```

## Step 4: Update Your Backend .env File

Update your `backend/.env` file with the database credentials:

```env
DB_NAME=mathmentor
DB_USER=mathmentor_user
DB_PASSWORD=your_secure_password_here
DB_HOST=your-vps-ip-or-domain
DB_PORT=5432
```

Replace:
- `your_secure_password_here` with the password you set in Step 1
- `your-vps-ip-or-domain` with your VPS IP address or domain name

## Step 5: Test Connection

From your local development machine, test the connection:

```bash
# Using psql (if installed)
psql -h YOUR_VPS_IP -U mathmentor_user -d mathmentor

# Or test from Django backend
cd backend
python manage.py dbshell
```

## Troubleshooting

### Connection Refused

- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Verify firewall allows port 5432: `sudo ufw status`
- Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*-main.log`

### Authentication Failed

- Verify the password in `.env` matches the one set in PostgreSQL
- Check `pg_hba.conf` configuration
- Ensure the user exists: `sudo -u postgres psql -c "\du"`

### Permission Denied

- Verify all GRANT statements were executed successfully
- Check schema ownership: `sudo -u postgres psql -d mathmentor -c "\dn"`

## Security Notes

- **Never use `0.0.0.0/0` in production** - Always restrict to specific IPs
- Use strong passwords for database users
- Consider using SSL/TLS for production connections
- Regularly update PostgreSQL: `sudo apt update && sudo apt upgrade postgresql`

## Next Steps

After completing this setup:

1. Update your `backend/.env` file with the database credentials
2. Run Django migrations: `python manage.py makemigrations && python manage.py migrate`
3. Start your Django server: `python manage.py runserver`
