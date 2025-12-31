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
)
from .jaas import generate_jaas_jwt, generate_room_name

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

    @action(detail=False, methods=['put', 'patch'])
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
        instance = self.get_object()
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

        # Get tutor by profile ID (what frontend sends)
        try:
            tutor_profile = TutorProfile.objects.select_related('user').get(
                id=serializer.validated_data['tutor_id'],
                is_profile_complete=True
            )
        except TutorProfile.DoesNotExist:
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

        # Generate meeting link
        session.meeting_link = f"https://meet.jit.si/mathmentor-{session.id}"
        session.save()

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

        # TODO: Handle refund if payment was made

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
        try:
            conversation = Conversation.objects.get(
                id=pk,
                participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Conversation not found'
            }, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get('content')
        if not content:
            return Response({
                'success': False,
                'message': 'Message content is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content
        )
        conversation.updated_at = timezone.now()
        conversation.save()

        serializer = MessageSerializer(message)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


# ==================== Stripe Webhook ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events."""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return Response({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return Response({'error': 'Invalid signature'}, status=400)

    if event['type'] == 'checkout.session.completed':
        checkout_session = event['data']['object']
        session_id = checkout_session['metadata'].get('session_id')
        
        if session_id:
            try:
                session = Session.objects.get(id=session_id)
                session.status = Session.Status.SCHEDULED
                session.stripe_payment_intent_id = checkout_session.get('payment_intent', '')
                session.generate_meeting_link()
                session.save()
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
