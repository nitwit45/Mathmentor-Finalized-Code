from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tutoring.models import Session
from tutoring.models import InstantConfig
from tutoring.serializers import InstantConfigSerializer
from .admin_serializers import (
    AdminDashboardSerializer,
    AdminUserSerializer,
    AdminSessionSerializer,
)
from .permissions import IsAdminUser


User = get_user_model()


class AdminDashboardView(APIView):
    """
    High-level statistics and recent activity for admins.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        # User counts by role
        total_users = User.objects.count()
        total_students = User.objects.filter(role="STUDENT").count()
        total_tutors = User.objects.filter(role="TUTOR").count()
        total_parents = User.objects.filter(role="PARENT").count()
        total_admins = User.objects.filter(role="ADMIN").count()

        # Session stats
        total_sessions = Session.objects.count()
        total_completed_sessions = Session.objects.filter(status="completed").count()
        total_cancelled_sessions = Session.objects.filter(status="cancelled").count()
        total_in_progress_sessions = Session.objects.filter(
            status__in=["in_progress", "scheduled", "confirmed"]
        ).count()

        # Revenue approximation from session price
        revenue_agg = (
            Session.objects.filter(status__in=["completed", "scheduled"])
            .aggregate(total_revenue=Sum("price"))
            .get("total_revenue")
            or 0
        )

        # Recent users and sessions
        recent_users_qs = (
            User.objects.all()
            .order_by("-created_at")[:10]
            .annotate(
                total_tutor_sessions=Count(
                    "tutor_sessions", distinct=True
                ),
                total_student_sessions=Count(
                    "student_sessions", distinct=True
                ),
            )
        )
        recent_sessions_qs = (
            Session.objects.select_related("tutor", "student")
            .order_by("-created_at")[:10]
        )

        serializer = AdminDashboardSerializer(
            {
                "total_users": total_users,
                "total_students": total_students,
                "total_tutors": total_tutors,
                "total_parents": total_parents,
                "total_admins": total_admins,
                "total_sessions": total_sessions,
                "total_completed_sessions": total_completed_sessions,
                "total_cancelled_sessions": total_cancelled_sessions,
                "total_in_progress_sessions": total_in_progress_sessions,
                "total_revenue": revenue_agg,
                "recent_users": recent_users_qs,
                "recent_sessions": recent_sessions_qs,
            }
        )
        return Response({"success": True, "data": serializer.data})


class AdminUserViewSet(viewsets.ModelViewSet):
    """
    Admin management of users (list, view, limited updates, delete).
    """

    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = User.objects.all().annotate(
            total_tutor_sessions=Count("tutor_sessions", distinct=True),
            total_student_sessions=Count("student_sessions", distinct=True),
        )

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)

        is_active = self.request.query_params.get("is_active")
        if is_active == "true":
            qs = qs.filter(is_active=True)
        elif is_active == "false":
            qs = qs.filter(is_active=False)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        joined_after = self.request.query_params.get("joined_after")
        if joined_after:
            qs = qs.filter(created_at__date__gte=joined_after)

        joined_before = self.request.query_params.get("joined_before")
        if joined_before:
            qs = qs.filter(created_at__date__lte=joined_before)

        return qs.order_by("-created_at")

    def destroy(self, request, *args, **kwargs):
        """
        Allow hard delete for now, but return a consistent envelope.
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"success": True, "message": "User deleted successfully"},
            status=status.HTTP_204_NO_CONTENT,
        )

    def list(self, request, *args, **kwargs):
        """
        Return users in a consistent {success, data} envelope.
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

    def retrieve(self, request, *args, **kwargs):
        """
        Return a single user in a {success, data} envelope.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"success": True, "data": serializer.data})


class AdminSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to all sessions for admins.
    """

    serializer_class = AdminSessionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = Session.objects.select_related("tutor", "student")

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        is_instant = self.request.query_params.get("is_instant")
        if is_instant == "true":
            qs = qs.filter(is_instant=True)
        elif is_instant == "false":
            qs = qs.filter(is_instant=False)

        tutor_id = self.request.query_params.get("tutor_id")
        if tutor_id:
            qs = qs.filter(tutor_id=tutor_id)

        student_id = self.request.query_params.get("student_id")
        if student_id:
            qs = qs.filter(student_id=student_id)

        from_date = self.request.query_params.get("from")
        if from_date:
            qs = qs.filter(scheduled_time__date__gte=from_date)

        to_date = self.request.query_params.get("to")
        if to_date:
            qs = qs.filter(scheduled_time__date__lte=to_date)

        return qs.order_by("-scheduled_time")

    def list(self, request, *args, **kwargs):
        """
        Return sessions in a {success, data} envelope.
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class AdminInstantConfigView(APIView):
    """
    Admin management of instant (Uber-style) tutoring pricing.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self):
        config = InstantConfig.objects.first()
        if not config:
            config = InstantConfig.objects.create()
        return config

    def get(self, request):
        config = self.get_object()
        serializer = InstantConfigSerializer(config)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        config = self.get_object()
        serializer = InstantConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data})
        return Response(
            {"success": False, "message": "Validation failed", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

