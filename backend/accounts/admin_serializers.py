from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from rest_framework import serializers

from tutoring.models import Session
from tutoring.serializers import UserBasicSerializer


User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    """Serializer for admin view of users with basic stats."""

    full_name = serializers.SerializerMethodField()
    total_tutor_sessions = serializers.IntegerField(read_only=True)
    total_student_sessions = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "is_active",
            "is_superuser",
            "is_staff",
            "is_email_verified",
            "created_at",
            "last_login",
            "total_tutor_sessions",
            "total_student_sessions",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "last_login",
            "is_superuser",
            "is_staff",
        ]

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.email


class AdminSessionSerializer(serializers.ModelSerializer):
    """Serializer for admin view of sessions."""

    tutor = UserBasicSerializer(read_only=True)
    student = UserBasicSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "tutor",
            "student",
            "scheduled_time",
            "duration",
            "topic",
            "notes",
            "status",
            "status_display",
            "meeting_link",
            "price",
            "is_instant",
            "stripe_payment_intent_id",
            "stripe_checkout_session_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class AdminDashboardSerializer(serializers.Serializer):
    """Shape for admin dashboard summary."""

    total_users = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_tutors = serializers.IntegerField()
    total_parents = serializers.IntegerField()
    total_admins = serializers.IntegerField()

    total_sessions = serializers.IntegerField()
    total_completed_sessions = serializers.IntegerField()
    total_cancelled_sessions = serializers.IntegerField()
    total_in_progress_sessions = serializers.IntegerField()

    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)

    recent_users = AdminUserSerializer(many=True)
    recent_sessions = AdminSessionSerializer(many=True)

