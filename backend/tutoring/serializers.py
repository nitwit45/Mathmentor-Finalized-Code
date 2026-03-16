from rest_framework import serializers
from django.contrib.auth import get_user_model
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

User = get_user_model()


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info serializer."""
    full_name = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role', 'profile_image_url']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

    def get_profile_image_url(self, obj):
        """Get profile image URL from user's profile (tutor or student)."""
        try:
            if hasattr(obj, 'tutor_profile') and obj.tutor_profile.profile_image:
                # Return relative URL to avoid mixed-content issues when the frontend is served over HTTPS
                return obj.tutor_profile.profile_image.url
            elif hasattr(obj, 'student_profile') and obj.student_profile.profile_image:
                # Return relative URL to avoid mixed-content issues when the frontend is served over HTTPS
                return obj.student_profile.profile_image.url
        except Exception:
            pass
        return None


class TutorProfileSerializer(serializers.ModelSerializer):
    """Serializer for tutor profiles."""
    user = UserBasicSerializer(read_only=True)
    subjects_display = serializers.SerializerMethodField()
    grades_display = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = TutorProfile
        fields = [
            'id', 'user', 'bio', 'hourly_rate', 'subjects', 'subjects_display',
            'grades_taught', 'grades_display', 'qualifications', 'profile_image',
            'profile_image_url', 'is_available_for_instant', 'is_profile_complete',
            'total_sessions', 'total_hours', 'average_rating', 'total_reviews',
            'total_earnings', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'is_profile_complete', 'total_sessions', 'total_hours',
            'average_rating', 'total_reviews', 'total_earnings', 'created_at', 'updated_at'
        ]

    def get_subjects_display(self, obj):
        subject_map = dict(MATH_SUBJECTS)
        return [{'key': s, 'label': subject_map.get(s, s)} for s in obj.subjects]

    def get_grades_display(self, obj):
        grade_map = dict(UK_GRADES)
        return [{'key': g, 'label': grade_map.get(g, g)} for g in obj.grades_taught]

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            # Return relative URL so the browser uses the current (HTTPS) origin
            return obj.profile_image.url
        return None

    def validate_subjects(self, value):
        valid_subjects = [s[0] for s in MATH_SUBJECTS]
        for subject in value:
            if subject not in valid_subjects:
                raise serializers.ValidationError(f"Invalid subject: {subject}")
        return value

    def validate_grades_taught(self, value):
        valid_grades = [g[0] for g in UK_GRADES]
        for grade in value:
            if grade not in valid_grades:
                raise serializers.ValidationError(f"Invalid grade: {grade}")
        return value

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        # Check if profile is complete
        if (instance.bio and instance.subjects and instance.grades_taught 
            and instance.hourly_rate > 0):
            instance.is_profile_complete = True
            instance.save()
        return instance


class TutorProfilePublicSerializer(serializers.ModelSerializer):
    """Public serializer for tutor profiles (for students viewing)."""
    user = UserBasicSerializer(read_only=True)
    subjects_display = serializers.SerializerMethodField()
    grades_display = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = TutorProfile
        fields = [
            'id', 'user', 'bio', 'hourly_rate', 'subjects', 'subjects_display',
            'grades_taught', 'grades_display', 'qualifications', 'profile_image_url',
            'is_available_for_instant', 'total_sessions', 'average_rating', 'total_reviews',
        ]

    def get_subjects_display(self, obj):
        subject_map = dict(MATH_SUBJECTS)
        return [{'key': s, 'label': subject_map.get(s, s)} for s in obj.subjects]

    def get_grades_display(self, obj):
        grade_map = dict(UK_GRADES)
        return [{'key': g, 'label': grade_map.get(g, g)} for g in obj.grades_taught]

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            # Return relative URL so the browser uses the current (HTTPS) origin
            return obj.profile_image.url
        return None


class StudentProfileSerializer(serializers.ModelSerializer):
    """Serializer for student profiles."""
    user = UserBasicSerializer(read_only=True)
    current_grade_display = serializers.SerializerMethodField()
    subjects_display = serializers.SerializerMethodField()
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user', 'current_grade', 'current_grade_display',
            'subjects_needed', 'subjects_display', 'learning_goals',
            'profile_image', 'profile_image_url', 'is_profile_complete',
            'total_sessions', 'total_hours', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user', 'is_profile_complete', 'total_sessions',
            'total_hours', 'created_at', 'updated_at'
        ]

    def get_current_grade_display(self, obj):
        grade_map = dict(UK_GRADES)
        return grade_map.get(obj.current_grade, obj.current_grade)

    def get_subjects_display(self, obj):
        subject_map = dict(MATH_SUBJECTS)
        return [{'key': s, 'label': subject_map.get(s, s)} for s in obj.subjects_needed]

    def get_profile_image_url(self, obj):
        if obj.profile_image:
            # Return relative URL so the browser uses the current (HTTPS) origin
            return obj.profile_image.url
        return None

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        # Check if profile is complete
        if instance.current_grade and instance.subjects_needed:
            instance.is_profile_complete = True
            instance.save()
        return instance


class SessionSerializer(serializers.ModelSerializer):
    """Serializer for sessions."""
    tutor = UserBasicSerializer(read_only=True)
    student = UserBasicSerializer(read_only=True)
    tutor_profile = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_join = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'tutor', 'student', 'tutor_profile', 'scheduled_time',
            'duration', 'topic', 'notes', 'status', 'status_display',
            'meeting_link', 'price', 'is_instant', 'can_join',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'tutor', 'student', 'meeting_link', 'status',
            'stripe_payment_intent_id', 'stripe_checkout_session_id',
            'created_at', 'updated_at'
        ]

    def get_tutor_profile(self, obj):
        try:
            profile = obj.tutor.tutor_profile
            return TutorProfilePublicSerializer(profile, context=self.context).data
        except TutorProfile.DoesNotExist:
            return None

    def get_can_join(self, obj):
        return obj.can_join()


class SessionCreateSerializer(serializers.Serializer):
    """Serializer for creating a session booking."""
    tutor_id = serializers.IntegerField()
    scheduled_time = serializers.DateTimeField()
    duration = serializers.IntegerField(default=60, min_value=30, max_value=180)
    topic = serializers.CharField(max_length=200)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)


class SessionReviewSerializer(serializers.ModelSerializer):
    """Serializer for session reviews."""
    
    class Meta:
        model = SessionReview
        fields = ['id', 'session', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'session', 'created_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations."""
    participants = UserBasicSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'participants', 'other_participant', 'last_message',
            'unread_count', 'created_at', 'updated_at'
        ]

    def get_other_participant(self, obj):
        request = self.context.get('request')
        if request and request.user:
            other = obj.get_other_participant(request.user)
            if other:
                return UserBasicSerializer(other).data
        return None

    def get_last_message(self, obj):
        message = obj.messages.last()
        if message:
            return {
                'id': str(message.id),
                'content': message.content[:50] + '...' if len(message.content) > 50 else message.content,
                'sender_id': message.sender.id,
                'created_at': message.created_at.isoformat(),
                'is_read': message.is_read,
                'delivered_at': message.delivered_at.isoformat() if message.delivered_at else None,
                'read_at': message.read_at.isoformat() if message.read_at else None,
                'status': message.status,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages."""
    sender = UserBasicSerializer(read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'content', 'is_read', 'delivered_at', 'read_at', 'created_at', 'status']
        read_only_fields = ['id', 'sender', 'is_read', 'delivered_at', 'read_at', 'created_at']
    
    def get_status(self, obj):
        """Get message delivery status."""
        return obj.status


class InstantRequestSerializer(serializers.ModelSerializer):
    """Serializer for instant tutoring requests."""
    student = UserBasicSerializer(read_only=True)
    matched_tutor = UserBasicSerializer(read_only=True)
    subject_display = serializers.CharField(source='get_subject_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = InstantRequest
        fields = [
            'id', 'student', 'subject', 'subject_display', 'grade', 'grade_display',
            'topic_description', 'status', 'status_display', 'matched_tutor',
            'expires_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'student', 'status', 'matched_tutor', 'session',
            'expires_at', 'created_at', 'updated_at'
        ]


class TutorAvailabilitySerializer(serializers.ModelSerializer):
    """Serializer for tutor availability."""
    day_display = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = TutorAvailability
        fields = ['id', 'day_of_week', 'day_display', 'start_time', 'end_time', 'is_active']
        read_only_fields = ['id']


class SubjectChoiceSerializer(serializers.Serializer):
    """Serializer for subject choices."""
    key = serializers.CharField()
    label = serializers.CharField()


class GradeChoiceSerializer(serializers.Serializer):
    """Serializer for grade choices."""
    key = serializers.CharField()
    label = serializers.CharField()


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payment history records."""
    payer = UserBasicSerializer(read_only=True)
    recipient = UserBasicSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_topic = serializers.CharField(source='session.topic', read_only=True)
    session_duration = serializers.IntegerField(source='session.duration', read_only=True)
    session_scheduled_time = serializers.DateTimeField(source='session.scheduled_time', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice_number', 'session_id', 'session_topic',
            'session_duration', 'session_scheduled_time',
            'payer', 'recipient', 'amount', 'stripe_payment_intent_id',
            'status', 'status_display', 'paid_at', 'created_at',
        ]
        read_only_fields = fields


class CalendarSessionSerializer(serializers.ModelSerializer):
    """Lightweight serializer for calendar view."""
    tutor_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'scheduled_time', 'duration', 'topic', 'status',
            'tutor_name', 'student_name', 'price',
        ]

    def get_tutor_name(self, obj):
        return f"{obj.tutor.first_name} {obj.tutor.last_name}".strip() or obj.tutor.email

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip() or obj.student.email


class InstantConfigSerializer(serializers.ModelSerializer):
    """Serializer for admin management of instant tutoring configuration."""

    class Meta:
        model = InstantConfig
        fields = ["hourly_rate", "updated_at"]
        read_only_fields = ["updated_at"]

