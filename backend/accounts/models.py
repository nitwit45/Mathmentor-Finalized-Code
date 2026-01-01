from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random


class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier."""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom User model with email as username and role field."""
    
    class Role(models.TextChoices):
        TUTOR = 'TUTOR', 'Tutor'
        STUDENT = 'STUDENT', 'Student'
        PARENT = 'PARENT', 'Parent'
    
    username = None  # Remove username field
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        null=True,
        blank=True
    )
    is_email_verified = models.BooleanField(default=False)
    verification_code = models.CharField(max_length=6, null=True, blank=True)
    verification_code_expires_at = models.DateTimeField(null=True, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    objects = UserManager()
    
    def __str__(self):
        return self.email
    
    def generate_verification_code(self):
        """Generate a 6-digit verification code and set expiration (15 minutes)."""
        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        self.verification_code = code
        self.verification_code_expires_at = timezone.now() + timedelta(minutes=15)
        self.save()
        return code
    
    def is_verification_code_valid(self, code):
        """Check if the provided code is valid and not expired."""
        if not self.verification_code or not self.verification_code_expires_at:
            return False
        if self.verification_code != code:
            return False
        if timezone.now() > self.verification_code_expires_at:
            return False
        return True
    
    def verify_email(self, code):
        """Verify email with the provided code."""
        if self.is_verification_code_valid(code):
            self.is_email_verified = True
            self.verification_code = None
            self.verification_code_expires_at = None
            self.save()
            return True
        return False


class PaymentMethod(models.Model):
    """Saved payment methods (cards) for users."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payment_methods'
    )
    stripe_payment_method_id = models.CharField(max_length=255)
    card_brand = models.CharField(max_length=50)  # visa, mastercard, etc.
    card_last4 = models.CharField(max_length=4)
    card_exp_month = models.PositiveIntegerField()
    card_exp_year = models.PositiveIntegerField()
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_default', '-created_at']
    
    def __str__(self):
        return f"{self.card_brand} ****{self.card_last4} ({self.user.email})"
    
    def save(self, *args, **kwargs):
        # If this is being set as default, unset other defaults
        if self.is_default:
            PaymentMethod.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)

