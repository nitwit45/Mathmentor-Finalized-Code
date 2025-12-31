from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def send_verification_email(user):
    """Send verification email with 6-digit code to user."""
    code = user.generate_verification_code()
    
    subject = 'Verify Your Mathmentor Account'
    
    # HTML email template
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: 'Cormorant Garamond', serif;
                background-color: #1a1a1a;
                color: #F0E2B7;
                padding: 20px;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background-color: #2a2520;
                padding: 30px;
                border-radius: 12px;
                border: 2px solid hsl(39, 77%, 47%);
            }}
            h1 {{
                font-family: 'Cinzel', serif;
                color: hsl(42, 80%, 60%);
                text-align: center;
                margin-bottom: 20px;
            }}
            .code-container {{
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
            }}
            .verification-code {{
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 8px;
                color: hsl(42, 80%, 60%);
                font-family: monospace;
            }}
            .footer {{
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #B0A69B;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Welcome to Mathmentor</h1>
            <p>Thank you for signing up! Please verify your email address by entering the code below:</p>
            
            <div class="code-container">
                <div class="verification-code">{code}</div>
            </div>
            
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
            
            <div class="footer">
                <p>© 2025 Mathmentor. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )
    
    return code

