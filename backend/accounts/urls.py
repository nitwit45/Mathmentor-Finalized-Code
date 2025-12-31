from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, get_csrf_token

router = DefaultRouter()
router.register(r'', AuthViewSet, basename='auth')

urlpatterns = [
    path('csrf-token/', get_csrf_token, name='csrf-token'),
    path('tutor/signup/', AuthViewSet.as_view({'post': 'tutor_signup'}), name='tutor-signup'),
    path('student/signup/', AuthViewSet.as_view({'post': 'student_signup'}), name='student-signup'),
    path('parent/signup/', AuthViewSet.as_view({'post': 'parent_signup'}), name='parent-signup'),
    path('login/', AuthViewSet.as_view({'post': 'login'}), name='login'),
    path('logout/', AuthViewSet.as_view({'post': 'logout'}), name='logout'),
    path('profile/', AuthViewSet.as_view({'get': 'profile'}), name='profile'),
    path('verify-email/', AuthViewSet.as_view({'post': 'verify_email'}), name='verify-email'),
    path('resend-verification/', AuthViewSet.as_view({'post': 'resend_verification'}), name='resend-verification'),
]

