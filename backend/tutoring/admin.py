from django.contrib import admin
from .models import (
    TutorProfile,
    StudentProfile,
    Session,
    SessionReview,
    Conversation,
    Message,
    InstantRequest,
    TutorAvailability,
)


@admin.register(TutorProfile)
class TutorProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'hourly_rate', 'is_available_for_instant', 'is_profile_complete', 'average_rating', 'total_sessions']
    list_filter = ['is_available_for_instant', 'is_profile_complete']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'current_grade', 'is_profile_complete', 'total_sessions']
    list_filter = ['current_grade', 'is_profile_complete']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'tutor', 'scheduled_time', 'status', 'price', 'is_instant']
    list_filter = ['status', 'is_instant', 'scheduled_time']
    search_fields = ['student__email', 'tutor__email', 'topic']
    date_hierarchy = 'scheduled_time'


@admin.register(SessionReview)
class SessionReviewAdmin(admin.ModelAdmin):
    list_display = ['session', 'rating', 'created_at']
    list_filter = ['rating']


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'updated_at']
    filter_horizontal = ['participants']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'sender', 'is_read', 'created_at']
    list_filter = ['is_read']
    search_fields = ['sender__email', 'content']


@admin.register(InstantRequest)
class InstantRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'subject', 'grade', 'status', 'matched_tutor', 'created_at']
    list_filter = ['status', 'subject', 'grade']
    search_fields = ['student__email']


@admin.register(TutorAvailability)
class TutorAvailabilityAdmin(admin.ModelAdmin):
    list_display = ['tutor', 'day_of_week', 'start_time', 'end_time', 'is_active']
    list_filter = ['day_of_week', 'is_active']
    search_fields = ['tutor__email']
