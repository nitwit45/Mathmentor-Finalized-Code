from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .admin_views import (
    AdminDashboardView,
    AdminUserViewSet,
    AdminSessionViewSet,
    AdminInstantConfigView,
)


router = DefaultRouter()
router.register(r"users", AdminUserViewSet, basename="admin-users")
router.register(r"sessions", AdminSessionViewSet, basename="admin-sessions")


urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("instant-config/", AdminInstantConfigView.as_view(), name="admin-instant-config"),
    path("", include(router.urls)),
]

