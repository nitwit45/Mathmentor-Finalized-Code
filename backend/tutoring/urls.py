from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'profile', views.ProfileViewSet, basename='profile')
router.register(r'conversations', views.ConversationViewSet, basename='conversations')
router.register(r'availability', views.TutorAvailabilityViewSet, basename='availability')

session_viewset = views.SessionViewSet.as_view({
    'get': 'list',
})
session_detail_viewset = views.SessionViewSet.as_view({
    'get': 'retrieve',
})
session_create_booking = views.SessionViewSet.as_view({
    'post': 'create_booking',
})
session_cancel = views.SessionViewSet.as_view({
    'post': 'cancel',
})
session_update_status = views.SessionViewSet.as_view({
    'post': 'update_status',
})
session_complete = views.SessionViewSet.as_view({
    'post': 'complete',
})
session_end = views.SessionViewSet.as_view({
    'post': 'end_session',
})
session_review = views.SessionViewSet.as_view({
    'post': 'review',
})
session_jaas_token = views.SessionViewSet.as_view({
    'get': 'jaas_token',
})

urlpatterns = [
    path('', include(router.urls)),
    
    # Session endpoints (explicit routing for actions)
    path('sessions/', session_viewset, name='session-list'),
    path('sessions/<uuid:pk>/', session_detail_viewset, name='session-detail'),
    path('sessions/create-booking/', session_create_booking, name='session-create-booking'),
    path('sessions/<uuid:pk>/cancel/', session_cancel, name='session-cancel'),
    path('sessions/<uuid:pk>/update-status/', session_update_status, name='session-update-status'),
    path('sessions/<uuid:pk>/complete/', session_complete, name='session-complete'),
    path('sessions/<uuid:pk>/end/', session_end, name='session-end'),
    path('sessions/<uuid:pk>/review/', session_review, name='session-review'),
    path('sessions/<uuid:pk>/jaas-token/', session_jaas_token, name='session-jaas-token'),
    
    # Tutor endpoints
    path('tutors/', views.TutorListView.as_view(), name='tutor-list'),
    path('tutors/<int:id>/', views.TutorDetailView.as_view(), name='tutor-detail'),
    path('tutors/<int:tutor_id>/availability/', views.get_tutor_availability, name='tutor-availability'),
    
    # Stripe/Payment endpoints
    path('stripe/config/', views.get_stripe_config, name='stripe-config'),
    path('stripe/webhook/', views.stripe_webhook, name='stripe-webhook'),
    path('payment-methods/', views.get_payment_methods, name='payment-methods'),
    path('payment-methods/setup-intent/', views.create_setup_intent, name='setup-intent'),
    path('payment-methods/save/', views.save_payment_method, name='save-payment-method'),
    path('payment-methods/<int:payment_method_id>/', views.delete_payment_method, name='delete-payment-method'),
    path('payment-methods/<int:payment_method_id>/default/', views.set_default_payment_method, name='set-default-payment-method'),
    path('sessions/<uuid:session_id>/checkout/', views.create_checkout_session, name='session-checkout'),
    path('sessions/<uuid:session_id>/pay/', views.pay_with_saved_card, name='session-pay'),
]

