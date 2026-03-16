from rest_framework import status, viewsets, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import stripe

from .models import (
    TutorProfile,
    StudentProfile,
    Session,
    SessionReview,
    Conversation,
    Message,
    InstantRequest,
    TutorAvailability,
    MATH_SUBJECTS,
    UK_GRADES,
    InstantConfig,
    Payment,
)
from .serializers import (
    TutorProfileSerializer,
    TutorProfilePublicSerializer,
    StudentProfileSerializer,
    SessionSerializer,
    SessionCreateSerializer,
    SessionReviewSerializer,
    ConversationSerializer,
    MessageSerializer,
    InstantRequestSerializer,
    TutorAvailabilitySerializer,
    InstantConfigSerializer,
    PaymentSerializer,
    CalendarSessionSerializer,
)
from .jaas import generate_jaas_jwt, generate_room_name
from .payments import get_or_create_stripe_customer

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 50


# ==================== Profile Views ====================

class ProfileViewSet(viewsets.ViewSet):
    """ViewSet for user profile management."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile based on their role."""
        user = request.user

        if user.role == 'TUTOR':
            profile, created = TutorProfile.objects.get_or_create(user=user)
            serializer = TutorProfileSerializer(profile, context={'request': request})
        elif user.role == 'STUDENT':
            profile, created = StudentProfile.objects.get_or_create(user=user)
            serializer = StudentProfileSerializer(profile, context={'request': request})
        else:
            return Response({
                'success': False,
                'message': 'Invalid user role'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'success': True,
            'data': serializer.data,
            'is_profile_complete': profile.is_profile_complete,
        })

    @action(detail=False, methods=['patch'])
    def update_me(self, request):
        """Update current user's profile."""
        user = request.user

        if user.role == 'TUTOR':
            profile, created = TutorProfile.objects.get_or_create(user=user)
            serializer = TutorProfileSerializer(
                profile, data=request.data, partial=True, context={'request': request}
            )
        elif user.role == 'STUDENT':
            profile, created = StudentProfile.objects.get_or_create(user=user)
            serializer = StudentProfileSerializer(
                profile, data=request.data, partial=True, context={'request': request}
            )
        else:
            return Response({
                'success': False,
                'message': 'Invalid user role'
            }, status=status.HTTP_400_BAD_REQUEST)

        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Profile updated successfully',
                'data': serializer.data,
            })
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def choices(self, request):
        """Get available choices for subjects and grades."""
        return Response({
            'success': True,
            'data': {
                'subjects': [{'key': k, 'label': v} for k, v in MATH_SUBJECTS],
                'grades': [{'key': k, 'label': v} for k, v in UK_GRADES],
            }
        })


# ==================== Tutor Views ====================

class TutorListView(generics.ListAPIView):
    """List and search tutors."""
    serializer_class = TutorProfilePublicSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TutorProfile.objects.filter(
            is_profile_complete=True
        ).select_related('user')

        # Filter by subject
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subjects__contains=[subject])

        # Filter by grade
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grades_taught__contains=[grade])

        # Filter by availability for instant
        instant_available = self.request.query_params.get('instant_available')
        if instant_available == 'true':
            queryset = queryset.filter(is_available_for_instant=True)

        # Filter by price range
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            queryset = queryset.filter(hourly_rate__gte=float(min_price))
        if max_price:
            queryset = queryset.filter(hourly_rate__lte=float(max_price))

        # Filter by minimum rating
        min_rating = self.request.query_params.get('min_rating')
        if min_rating:
            queryset = queryset.filter(average_rating__gte=float(min_rating))

        # Search by name
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(bio__icontains=search)
            )

        # Sorting
        sort = self.request.query_params.get('sort', '-average_rating')
        if sort in ['hourly_rate', '-hourly_rate', 'average_rating', '-average_rating', 'total_sessions', '-total_sessions']:
            queryset = queryset.order_by(sort)

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({
            'success': True,
            'data': response.data
        })


class TutorDetailView(generics.RetrieveAPIView):
    """Get tutor profile detail."""
    serializer_class = TutorProfilePublicSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return TutorProfile.objects.filter(is_profile_complete=True).select_related('user')

    def retrieve(self, request, *args, **kwargs):
        tutor_id = kwargs.get('id')

        # Try to get by TutorProfile ID first (existing behavior)
        instance = self.get_queryset().filter(id=tutor_id).first()

        if not instance:
            # If not found, try to get by User ID (new behavior for conversation flow)
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.get(id=tutor_id)
                instance = self.get_queryset().filter(user=user).first()

                if not instance:
                    return Response({
                        'success': False,
                        'message': 'Tutor not found'
                    }, status=status.HTTP_404_NOT_FOUND)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Tutor not found'
                }, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(instance)
        
        # Get reviews for this tutor
        reviews = SessionReview.objects.filter(
            session__tutor=instance.user
        ).order_by('-created_at')[:10]
        
        review_data = []
        for review in reviews:
            review_data.append({
                'id': review.id,
                'rating': review.rating,
                'comment': review.comment,
                'student_name': f"{review.session.student.first_name} {review.session.student.last_name[0]}.",
                'created_at': review.created_at.isoformat(),
            })

        return Response({
            'success': True,
            'data': {
                **serializer.data,
                'reviews': review_data,
            }
        })


# ==================== Session Views ====================

class SessionViewSet(viewsets.ViewSet):
    """ViewSet for session management."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List user's sessions."""
        user = request.user
        status_filter = request.query_params.get('status')
        time_filter = request.query_params.get('time', 'upcoming')

        if user.role == 'TUTOR':
            queryset = Session.objects.filter(tutor=user)
        else:
            queryset = Session.objects.filter(student=user)

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if status_filter:
            # If status filter is provided, don't apply time filter
            pass
        elif time_filter == 'upcoming':
            queryset = queryset.filter(
                scheduled_time__gte=timezone.now(),
                status__in=['scheduled', 'pending_payment', 'confirmed']
            )
        elif time_filter == 'past':
            queryset = queryset.filter(
                Q(scheduled_time__lt=timezone.now()) | Q(status__in=['completed', 'cancelled', 'no_show'])
            )

        queryset = queryset.select_related('tutor', 'student').order_by('scheduled_time')
        serializer = SessionSerializer(queryset, many=True, context={'request': request})
        
        return Response({
            'success': True,
            'data': serializer.data
        })

    def retrieve(self, request, pk=None):
        """Get session detail."""
        user = request.user
        try:
            session = Session.objects.select_related('tutor', 'student').get(
                Q(tutor=user) | Q(student=user),
                id=pk
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = SessionSerializer(session, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=False, methods=['post'])
    def create_booking(self, request):
        """Create a new session booking with Stripe checkout."""
        serializer = SessionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get tutor by profile ID or user ID (frontend sends either)
        tutor_id = serializer.validated_data['tutor_id']
        try:
            # First try to get by TutorProfile ID (existing behavior)
            tutor_profile = TutorProfile.objects.select_related('user').get(
                id=tutor_id,
                is_profile_complete=True
            )
        except TutorProfile.DoesNotExist:
            # If not found, try to get by User ID (new behavior for conversation flow)
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.get(id=tutor_id)
                tutor_profile = TutorProfile.objects.select_related('user').get(
                    user=user,
                    is_profile_complete=True
                )
            except (User.DoesNotExist, TutorProfile.DoesNotExist):
                return Response({
                    'success': False,
                    'message': 'Tutor not found'
                }, status=status.HTTP_404_NOT_FOUND)

        # Calculate price
        from decimal import Decimal
        duration = serializer.validated_data['duration']
        price = tutor_profile.hourly_rate * Decimal(duration) / Decimal(60)

        # Create session with pending_tutor status (tutor must accept first)
        session = Session.objects.create(
            tutor=tutor_profile.user,
            student=request.user,
            scheduled_time=serializer.validated_data['scheduled_time'],
            duration=duration,
            topic=serializer.validated_data['topic'],
            notes=serializer.validated_data.get('notes', ''),
            price=price,
            status=Session.Status.PENDING_TUTOR,
        )

        return Response({
            'success': True,
            'data': {
                'session_id': str(session.id),
                'message': 'Booking request sent to tutor. Waiting for approval.',
            }
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a session."""
        user = request.user
        try:
            session = Session.objects.get(
                Q(tutor=user) | Q(student=user),
                id=pk,
                status__in=['pending_tutor', 'pending_payment', 'confirmed', 'scheduled']
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found or cannot be cancelled'
            }, status=status.HTTP_404_NOT_FOUND)

        session.status = Session.Status.CANCELLED
        session.save()

        # Note: Refund handling for paid sessions can be added here via Stripe API
        # (stripe.Refund.create) when payment_intent_id is stored on the session.

        return Response({
            'success': True,
            'message': 'Session cancelled successfully'
        })

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update session status (for tutor approval flow)."""
        user = request.user
        new_status = request.data.get('status')
        
        if not new_status:
            return Response({
                'success': False,
                'message': 'Status is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            session = Session.objects.get(id=pk)
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Tutor can confirm or cancel pending_tutor sessions
        if user.role == 'TUTOR' and session.tutor == user:
            if session.status == 'pending_tutor':
                if new_status == 'confirmed':
                    session.status = Session.Status.CONFIRMED
                    session.save()
                    return Response({
                        'success': True,
                        'message': 'Session confirmed successfully'
                    })
                elif new_status == 'cancelled':
                    session.status = Session.Status.CANCELLED
                    session.save()
                    return Response({
                        'success': True,
                        'message': 'Session declined'
                    })
        
        # Either party can cancel confirmed sessions
        if new_status == 'cancelled' and session.status in ['pending_tutor', 'confirmed', 'scheduled']:
            if session.tutor == user or session.student == user:
                session.status = Session.Status.CANCELLED
                session.save()
                return Response({
                    'success': True,
                    'message': 'Session cancelled'
                })
        
        return Response({
            'success': False,
            'message': 'Cannot update session status'
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a session as completed (tutor only)."""
        user = request.user
        try:
            session = Session.objects.get(
                tutor=user,
                id=pk,
                status='in_progress'
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found or cannot be completed'
            }, status=status.HTTP_404_NOT_FOUND)

        session.status = Session.Status.COMPLETED
        session.save()

        # Update tutor stats
        tutor_profile = user.tutor_profile
        tutor_profile.total_sessions += 1
        tutor_profile.total_hours += Decimal(session.duration) / 60
        tutor_profile.total_earnings += session.price
        tutor_profile.save()

        # Update student stats
        student_profile = session.student.student_profile
        student_profile.total_sessions += 1
        student_profile.total_hours += Decimal(session.duration) / 60
        student_profile.save()

        return Response({
            'success': True,
            'message': 'Session completed successfully'
        })

    @action(detail=True, methods=['post'])
    def end_session(self, request, pk=None):
        """Allow tutor to end a session (cancel before start, complete if in progress)."""
        user = request.user

        # Only tutors can end sessions
        if user.role != 'TUTOR':
            return Response({
                'success': False,
                'message': 'Only tutors can end sessions'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            session = Session.objects.get(
                tutor=user,
                id=pk,
                status__in=['scheduled', 'confirmed', 'in_progress']
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found or cannot be ended'
            }, status=status.HTTP_404_NOT_FOUND)

        # If session is in progress, complete it
        if session.status == 'in_progress':
            session.status = Session.Status.COMPLETED
            session.save()

            # Update tutor stats
            tutor_profile = user.tutor_profile
            tutor_profile.total_sessions += 1
            tutor_profile.total_hours += session.duration / 60
            tutor_profile.total_earnings += session.price
            tutor_profile.save()

            # Update student stats
            student_profile = session.student.student_profile
            student_profile.total_sessions += 1
            student_profile.total_hours += session.duration / 60
            student_profile.save()

            return Response({
                'success': True,
                'message': 'Session completed successfully'
            })

        # If session is scheduled/confirmed, cancel it
        else:
            session.status = Session.Status.CANCELLED
            session.save()

            return Response({
                'success': True,
                'message': 'Session cancelled successfully'
            })

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Add a review for a completed session (student only)."""
        user = request.user
        try:
            session = Session.objects.get(
                student=user,
                id=pk,
                status='completed'
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found or cannot be reviewed'
            }, status=status.HTTP_404_NOT_FOUND)

        if hasattr(session, 'review'):
            return Response({
                'success': False,
                'message': 'Session already has a review'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = SessionReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(session=session)
            return Response({
                'success': True,
                'message': 'Review submitted successfully',
                'data': serializer.data
            })
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def jaas_token(self, request, pk=None):
        """Get JaaS JWT token to join a video session."""
        user = request.user
        try:
            session = Session.objects.select_related('tutor', 'student').get(
                Q(tutor=user) | Q(student=user),
                id=pk
            )
        except Session.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if session can be joined
        if not session.can_join():
            return Response({
                'success': False,
                'message': 'Session cannot be joined at this time'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Determine if user is moderator (tutor is always moderator)
        is_moderator = user.role == 'TUTOR' and session.tutor == user

        # Generate room name and JWT
        room_name = generate_room_name(session.id)
        jwt_token = generate_jaas_jwt(
            user=user,
            room_name=room_name,
            is_moderator=is_moderator,
            duration_minutes=session.duration
        )

        return Response({
            'success': True,
            'data': {
                'jwt': jwt_token,
                'room_name': room_name,
                'app_id': settings.JAAS_APP_ID,
                'domain': '8x8.vc',
                'user_info': {
                    'name': f"{user.first_name} {user.last_name}".strip() or user.email,
                    'email': user.email,
                    'is_moderator': is_moderator,
                },
                'session_info': {
                    'topic': session.topic,
                    'duration': session.duration,
                    'tutor_name': f"{session.tutor.first_name} {session.tutor.last_name}",
                    'student_name': f"{session.student.first_name} {session.student.last_name}",
                }
            }
        })

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Return sessions for a given month grouped by date."""
        import calendar as cal
        user = request.user

        try:
            month = int(request.query_params.get('month', timezone.now().month))
            year = int(request.query_params.get('year', timezone.now().year))
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'message': 'Invalid month or year'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Clamp values
        month = max(1, min(12, month))
        _, days_in_month = cal.monthrange(year, month)

        start_dt = timezone.datetime(year, month, 1, tzinfo=timezone.UTC)
        end_dt = timezone.datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.UTC)

        if user.role == 'TUTOR':
            queryset = Session.objects.filter(tutor=user)
        else:
            queryset = Session.objects.filter(student=user)

        queryset = queryset.filter(
            scheduled_time__gte=start_dt,
            scheduled_time__lte=end_dt,
        ).select_related('tutor', 'student').order_by('scheduled_time')

        serializer = CalendarSessionSerializer(queryset, many=True)

        # Group sessions by date string (YYYY-MM-DD)
        grouped = {}
        for session_data in serializer.data:
            dt_str = session_data['scheduled_time']
            # Extract date portion
            date_key = dt_str[:10]
            if date_key not in grouped:
                grouped[date_key] = []
            grouped[date_key].append(session_data)

        return Response({
            'success': True,
            'data': {
                'month': month,
                'year': year,
                'days_in_month': days_in_month,
                'sessions_by_date': grouped,
                'total_sessions': queryset.count(),
            }
        })


# ==================== Messaging Views ====================

class ConversationViewSet(viewsets.ViewSet):
    """ViewSet for conversation management."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List user's conversations."""
        conversations = Conversation.objects.filter(
            participants=request.user
        ).prefetch_related('participants', 'messages').order_by('-updated_at')
        
        serializer = ConversationSerializer(
            conversations, many=True, context={'request': request}
        )
        return Response({
            'success': True,
            'data': serializer.data
        })

    def retrieve(self, request, pk=None):
        """Get conversation with messages."""
        try:
            conversation = Conversation.objects.prefetch_related(
                'participants', 'messages__sender'
            ).get(
                id=pk,
                participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Conversation not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Mark messages as read
        conversation.messages.exclude(sender=request.user).update(is_read=True)

        serializer = ConversationSerializer(conversation, context={'request': request})
        messages = MessageSerializer(conversation.messages.all(), many=True).data

        return Response({
            'success': True,
            'data': {
                **serializer.data,
                'messages': messages
            }
        })

    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start or get existing conversation with another user."""
        other_user_id = request.data.get('user_id')
        if not other_user_id:
            return Response({
                'success': False,
                'message': 'user_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check for existing conversation
        existing = Conversation.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()

        if existing:
            serializer = ConversationSerializer(existing, context={'request': request})
            return Response({
                'success': True,
                'data': serializer.data,
                'is_new': False
            })

        # Create new conversation
        conversation = Conversation.objects.create()
        conversation.participants.add(request.user, other_user)

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data,
            'is_new': True
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message in a conversation (REST fallback)."""
        # First check if conversation exists at all
        try:
            conversation = Conversation.objects.get(id=pk)
        except Conversation.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Conversation not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if user is a participant in this conversation
        if request.user not in conversation.participants.all():
            return Response({
                'success': False,
                'message': 'You do not have access to this conversation'
            }, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content')
        if not content or not content.strip():
            return Response({
                'success': False,
                'message': 'Message content is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content.strip()
        )
        conversation.updated_at = timezone.now()
        conversation.save()

        # Broadcast message via channel layer so WebSocket users receive it
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        room_group_name = f'chat_{conversation.id}'
        
        try:
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message.id),
                        'content': message.content,
                        'sender_id': message.sender.id,
                        'sender_name': f"{message.sender.first_name} {message.sender.last_name}",
                        'created_at': message.created_at.isoformat(),
                        'is_read': message.is_read,
                        'delivered_at': None,
                        'read_at': None,
                        'status': 'sent',
                    }
                }
            )
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to broadcast message via channel layer: {e}")

        serializer = MessageSerializer(message)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


# ==================== Stripe Payment ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_payment_methods(request):
    """Get user's saved payment methods."""
    from accounts.models import PaymentMethod
    
    payment_methods = PaymentMethod.objects.filter(user=request.user)
    data = [{
        'id': pm.id,
        'stripe_payment_method_id': pm.stripe_payment_method_id,
        'card_brand': pm.card_brand,
        'card_last4': pm.card_last4,
        'card_exp_month': pm.card_exp_month,
        'card_exp_year': pm.card_exp_year,
        'is_default': pm.is_default,
    } for pm in payment_methods]
    
    return Response({
        'success': True,
        'data': data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_setup_intent(request):
    """Create a SetupIntent for adding a new card."""
    # Check if Stripe is configured
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith('sk_test_placeholder'):
        return Response({
            'success': False,
            'message': 'Stripe is not configured. Please add your Stripe API keys.',
            'demo_mode': True
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        customer_id = get_or_create_stripe_customer(request.user)
        
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=['card'],
        )
        
        return Response({
            'success': True,
            'data': {
                'client_secret': setup_intent.client_secret,
                'setup_intent_id': setup_intent.id,
            }
        })
    except stripe.error.StripeError as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_payment_method(request):
    """Save a payment method after SetupIntent confirmation."""
    from accounts.models import PaymentMethod
    
    payment_method_id = request.data.get('payment_method_id')
    set_as_default = request.data.get('set_as_default', True)
    
    if not payment_method_id:
        return Response({
            'success': False,
            'message': 'Payment method ID is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if Stripe is configured
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith('sk_test_placeholder'):
        return Response({
            'success': False,
            'message': 'Stripe is not configured',
            'demo_mode': True
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Retrieve the payment method from Stripe
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        
        # Check if already saved
        if PaymentMethod.objects.filter(
            user=request.user,
            stripe_payment_method_id=payment_method_id
        ).exists():
            return Response({
                'success': False,
                'message': 'This card is already saved'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save locally
        is_first = not PaymentMethod.objects.filter(user=request.user).exists()
        payment_method = PaymentMethod.objects.create(
            user=request.user,
            stripe_payment_method_id=payment_method_id,
            card_brand=pm.card.brand,
            card_last4=pm.card.last4,
            card_exp_month=pm.card.exp_month,
            card_exp_year=pm.card.exp_year,
            is_default=set_as_default or is_first,
        )
        
        return Response({
            'success': True,
            'message': 'Card saved successfully',
            'data': {
                'id': payment_method.id,
                'card_brand': payment_method.card_brand,
                'card_last4': payment_method.card_last4,
                'is_default': payment_method.is_default,
            }
        })
    except stripe.error.StripeError as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_payment_method(request, payment_method_id):
    """Delete a saved payment method."""
    from accounts.models import PaymentMethod
    
    try:
        pm = PaymentMethod.objects.get(id=payment_method_id, user=request.user)
    except PaymentMethod.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Payment method not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Detach from Stripe if configured
    if settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith('sk_test_placeholder'):
        try:
            stripe.PaymentMethod.detach(pm.stripe_payment_method_id)
        except stripe.error.StripeError:
            pass  # Card may already be detached
    
    was_default = pm.is_default
    pm.delete()
    
    # If deleted card was default, set another as default
    if was_default:
        next_pm = PaymentMethod.objects.filter(user=request.user).first()
        if next_pm:
            next_pm.is_default = True
            next_pm.save()
    
    return Response({
        'success': True,
        'message': 'Card removed successfully'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_default_payment_method(request, payment_method_id):
    """Set a payment method as default."""
    from accounts.models import PaymentMethod
    
    try:
        pm = PaymentMethod.objects.get(id=payment_method_id, user=request.user)
    except PaymentMethod.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Payment method not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    pm.is_default = True
    pm.save()
    
    return Response({
        'success': True,
        'message': 'Default card updated'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay_with_saved_card(request, session_id):
    """Pay for a session using a saved card."""
    from accounts.models import PaymentMethod
    
    user = request.user
    payment_method_id = request.data.get('payment_method_id')
    
    if user.role != 'STUDENT':
        return Response({
            'success': False,
            'message': 'Only students can pay for sessions'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        session = Session.objects.get(id=session_id, student=user)
    except Session.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Session not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if session.status not in ['confirmed', 'pending_payment']:
        return Response({
            'success': False,
            'message': f'Session cannot be paid for. Current status: {session.status}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get payment method
    if payment_method_id:
        try:
            pm = PaymentMethod.objects.get(id=payment_method_id, user=user)
        except PaymentMethod.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Payment method not found'
            }, status=status.HTTP_404_NOT_FOUND)
    else:
        # Use default
        pm = PaymentMethod.objects.filter(user=user, is_default=True).first()
        if not pm:
            return Response({
                'success': False,
                'message': 'No payment method found. Please add a card first.'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if Stripe is configured
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith('sk_test_placeholder'):
        return Response({
            'success': False,
            'message': 'Stripe is not configured. Please add your Stripe API keys.',
            'demo_mode': True
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        customer_id = get_or_create_stripe_customer(user)
        
        # Create and confirm PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(session.price * 100),  # Convert to pence
            currency='gbp',
            customer=customer_id,
            payment_method=pm.stripe_payment_method_id,
            off_session=True,
            confirm=True,
            metadata={
                'session_id': str(session.id),
            },
            description=f'Tutoring Session: {session.topic}',
        )
        
        if payment_intent.status == 'succeeded':
            session.status = Session.Status.SCHEDULED
            session.stripe_payment_intent_id = payment_intent.id
            session.save()

            Payment.objects.get_or_create(
                session=session,
                defaults={
                    'payer': user,
                    'recipient': session.tutor,
                    'amount': session.price,
                    'stripe_payment_intent_id': payment_intent.id,
                    'status': Payment.Status.SUCCEEDED,
                    'invoice_number': Payment.generate_invoice_number(),
                    'paid_at': timezone.now(),
                }
            )

            return Response({
                'success': True,
                'message': 'Payment successful! Session is now scheduled.',
                'data': {
                    'session_id': str(session.id),
                    'status': session.status,
                    'payment_intent_id': payment_intent.id,
                }
            })
        else:
            return Response({
                'success': False,
                'message': f'Payment failed. Status: {payment_intent.status}'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except stripe.error.CardError as e:
        return Response({
            'success': False,
            'message': f'Card error: {e.user_message}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.StripeError as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_stripe_config(request):
    """Get Stripe publishable key for frontend."""
    publishable_key = settings.STRIPE_PUBLISHABLE_KEY
    is_configured = bool(publishable_key and not publishable_key.startswith('pk_test_placeholder'))
    
    return Response({
        'success': True,
        'data': {
            'publishable_key': publishable_key if is_configured else None,
            'is_configured': is_configured,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request, session_id):
    """Create a Stripe checkout session for payment."""
    user = request.user
    
    # Only students can pay for sessions
    if user.role != 'STUDENT':
        return Response({
            'success': False,
            'message': 'Only students can pay for sessions'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        session = Session.objects.get(id=session_id, student=user)
    except Session.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Session not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Only allow payment for confirmed sessions
    if session.status not in ['confirmed', 'pending_payment']:
        return Response({
            'success': False,
            'message': f'Session cannot be paid for. Current status: {session.status}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if Stripe is configured
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith('sk_test_placeholder'):
        # For demo/test mode without real Stripe keys, simulate payment success
        demo_intent_id = 'demo_payment_' + str(session.id)
        session.status = Session.Status.SCHEDULED
        session.stripe_payment_intent_id = demo_intent_id
        session.save()

        Payment.objects.get_or_create(
            session=session,
            defaults={
                'payer': user,
                'recipient': session.tutor,
                'amount': session.price,
                'stripe_payment_intent_id': demo_intent_id,
                'status': Payment.Status.SUCCEEDED,
                'invoice_number': Payment.generate_invoice_number(),
                'paid_at': timezone.now(),
            }
        )

        return Response({
            'success': True,
            'demo_mode': True,
            'message': 'Payment simulated (demo mode). Session is now scheduled.',
            'data': {
                'session_id': str(session.id),
                'status': session.status,
            }
        })
    
    try:
        # Get frontend URL for redirects
        frontend_url = settings.FRONTEND_URL or 'http://localhost:3000'
        
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'gbp',
                    'product_data': {
                        'name': f'Tutoring Session: {session.topic}',
                        'description': f'{session.duration} min session with {session.tutor.first_name} {session.tutor.last_name}',
                    },
                    'unit_amount': int(session.price * 100),  # Convert to pence
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/student/sessions/{session.id}?payment=success',
            cancel_url=f'{frontend_url}/student/sessions/{session.id}?payment=cancelled',
            metadata={
                'session_id': str(session.id),
            },
            customer_email=user.email,
        )
        
        # Save the checkout session ID
        session.stripe_checkout_session_id = checkout_session.id
        session.save()
        
        return Response({
            'success': True,
            'data': {
                'checkout_url': checkout_session.url,
                'checkout_session_id': checkout_session.id,
            }
        })
        
    except stripe.error.StripeError as e:
        return Response({
            'success': False,
            'message': str(e.user_message if hasattr(e, 'user_message') else str(e))
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events."""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    # If no webhook secret configured, skip signature verification (dev mode)
    if settings.STRIPE_WEBHOOK_SECRET and not settings.STRIPE_WEBHOOK_SECRET.startswith('whsec_placeholder'):
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return Response({'error': 'Invalid payload'}, status=400)
        except stripe.error.SignatureVerificationError:
            return Response({'error': 'Invalid signature'}, status=400)
    else:
        # Dev mode - parse without verification
        import json
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return Response({'error': 'Invalid payload'}, status=400)

    if event['type'] == 'checkout.session.completed':
        checkout_session = event['data']['object']
        session_id = checkout_session['metadata'].get('session_id')

        if session_id:
            try:
                session = Session.objects.select_related('student', 'tutor').get(id=session_id)
                session.status = Session.Status.SCHEDULED
                session.stripe_payment_intent_id = checkout_session.get('payment_intent', '')
                session.stripe_checkout_session_id = checkout_session.get('id', '')
                session.save()

                Payment.objects.get_or_create(
                    session=session,
                    defaults={
                        'payer': session.student,
                        'recipient': session.tutor,
                        'amount': session.price,
                        'stripe_payment_intent_id': checkout_session.get('payment_intent', ''),
                        'status': Payment.Status.SUCCEEDED,
                        'invoice_number': Payment.generate_invoice_number(),
                        'paid_at': timezone.now(),
                    }
                )
            except Session.DoesNotExist:
                pass

    return Response({'status': 'success'})


# ==================== Tutor Availability Views ====================

class TutorAvailabilityViewSet(viewsets.ModelViewSet):
    """ViewSet for tutor availability management."""
    serializer_class = TutorAvailabilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TutorAvailability.objects.filter(tutor=self.request.user)

    def perform_create(self, serializer):
        serializer.save(tutor=self.request.user)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({
            'success': True,
            'data': response.data
        })

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response({
            'success': True,
            'message': 'Availability added',
            'data': response.data
        }, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({
            'success': True,
            'message': 'Availability removed'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tutor_availability(request, tutor_id):
    """Get a tutor's availability schedule."""
    availabilities = TutorAvailability.objects.filter(
        tutor_id=tutor_id,
        is_active=True
    )
    serializer = TutorAvailabilitySerializer(availabilities, many=True)
    return Response({
        'success': True,
        'data': serializer.data
    })


class PaymentViewSet(viewsets.ViewSet):
    """ViewSet for payment history."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List the user's payment history."""
        user = request.user

        if user.role == 'STUDENT':
            queryset = Payment.objects.filter(payer=user)
        else:
            queryset = Payment.objects.filter(recipient=user)

        # Optional date range filters
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(paid_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(paid_at__date__lte=date_to)

        queryset = queryset.select_related(
            'session', 'payer', 'recipient'
        ).order_by('-paid_at')

        serializer = PaymentSerializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def retrieve(self, request, pk=None):
        """Get a single payment record (invoice detail)."""
        user = request.user
        try:
            payment = Payment.objects.select_related(
                'session', 'payer', 'recipient'
            ).get(
                Q(payer=user) | Q(recipient=user),
                id=pk
            )
        except Payment.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Payment not found'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = PaymentSerializer(payment)
        return Response({
            'success': True,
            'data': serializer.data
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_instant_config(request):
    """
    Get read-only instant tutoring configuration for students/tutors.
    """
    config = InstantConfig.objects.first()
    if not config:
        # Default fallback if admin hasn't configured yet
        config = InstantConfig(hourly_rate=Decimal("25.00"))
    serializer = InstantConfigSerializer(config)
    return Response({
        "success": True,
        "data": serializer.data,
    })
