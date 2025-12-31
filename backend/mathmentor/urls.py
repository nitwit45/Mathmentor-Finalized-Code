"""
URL configuration for mathmentor project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    """Health check endpoint."""
    return JsonResponse({
        'success': True,
        'message': 'Server is running',
        'status': 'healthy'
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health'),
    path('api/auth/', include('accounts.urls')),
]

