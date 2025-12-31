from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import login, logout
from django.utils import timezone
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import User
from .serializers import UserSerializer, SignUpSerializer, LoginSerializer
from .utils import send_verification_email


class AuthViewSet(viewsets.ViewSet):
    """ViewSet for authentication endpoints."""
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def tutor_signup(self, request):
        """Sign up as a tutor."""
        serializer = SignUpSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.role = User.Role.TUTOR
            user.save()
            
            # Send verification email
            try:
                send_verification_email(user)
            except Exception as e:
                # Log error but don't fail signup
                print(f"Error sending verification email: {e}")
            
            return Response({
                'success': True,
                'message': 'Tutor account created successfully. Please check your email for verification code.',
                'data': {
                    'email': user.email,
                    'id': user.id
                }
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def student_signup(self, request):
        """Sign up as a student."""
        serializer = SignUpSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.role = User.Role.STUDENT
            user.save()
            
            # Send verification email
            try:
                send_verification_email(user)
            except Exception as e:
                # Log error but don't fail signup
                print(f"Error sending verification email: {e}")
            
            return Response({
                'success': True,
                'message': 'Student account created successfully. Please check your email for verification code.',
                'data': {
                    'email': user.email,
                    'id': user.id
                }
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def parent_signup(self, request):
        """Sign up as a parent."""
        serializer = SignUpSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.role = User.Role.PARENT
            user.save()
            
            # Send verification email
            try:
                send_verification_email(user)
            except Exception as e:
                # Log error but don't fail signup
                print(f"Error sending verification email: {e}")
            
            return Response({
                'success': True,
                'message': 'Parent account created successfully. Please check your email for verification code.',
                'data': {
                    'email': user.email,
                    'id': user.id
                }
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        """Login endpoint."""
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Check if email is verified
            if not user.is_email_verified:
                return Response({
                    'success': False,
                    'message': 'Please verify your email before logging in.',
                    'errors': {'email': 'Email not verified'}
                }, status=status.HTTP_403_FORBIDDEN)
            
            login(request, user)
            return Response({
                'success': True,
                'message': 'Login successful',
                'data': UserSerializer(user).data
            }, status=status.HTTP_200_OK)
        return Response({
            'success': False,
            'message': 'Login failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """Logout endpoint."""
        logout(request)
        return Response({
            'success': True,
            'message': 'Logout successful'
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def profile(self, request):
        """Get current user profile."""
        return Response({
            'success': True,
            'data': UserSerializer(request.user).data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def verify_email(self, request):
        """Verify email with verification code."""
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response({
                'success': False,
                'message': 'Email and code are required',
                'errors': {'code': 'Email and code are required'}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User not found',
                'errors': {'email': 'User not found'}
            }, status=status.HTTP_404_NOT_FOUND)
        
        if user.is_email_verified:
            return Response({
                'success': False,
                'message': 'Email already verified',
                'errors': {'email': 'Email already verified'}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if user.verify_email(code):
            login(request, user)
            return Response({
                'success': True,
                'message': 'Email verified successfully',
                'data': UserSerializer(user).data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Invalid or expired verification code',
                'errors': {'code': 'Invalid or expired verification code'}
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def resend_verification(self, request):
        """Resend verification code."""
        email = request.data.get('email')
        
        if not email:
            return Response({
                'success': False,
                'message': 'Email is required',
                'errors': {'email': 'Email is required'}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User not found',
                'errors': {'email': 'User not found'}
            }, status=status.HTTP_404_NOT_FOUND)
        
        if user.is_email_verified:
            return Response({
                'success': False,
                'message': 'Email already verified',
                'errors': {'email': 'Email already verified'}
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            send_verification_email(user)
            return Response({
                'success': True,
                'message': 'Verification code sent successfully'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'message': 'Failed to send verification email',
                'errors': {'email': str(e)}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Returns CSRF token for the frontend.
    The @ensure_csrf_cookie decorator ensures the CSRF cookie is set.
    """
    return Response({
        'success': True,
        'csrfToken': get_token(request)
    })

