"""
Shared payment service for Mathmentor tutoring sessions.

Provides a single off-session charge helper used by both the REST
pay_with_saved_card view and the instant-session WebSocket consumer,
so Stripe logic and Payment record creation never diverge.
"""

import stripe
from django.conf import settings
from django.utils import timezone


def get_or_create_stripe_customer(user):
    """Return the Stripe customer ID for a user, creating one if needed."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=f"{user.first_name} {user.last_name}".strip() or user.email,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = customer.id
    user.save(update_fields=["stripe_customer_id"])
    return customer.id


def charge_session_with_default_card(session, student):
    """
    Charge the student's default saved card for a session off-session.

    Does NOT change session.status — callers own status transitions.
    Sets session.stripe_payment_intent_id and creates a Payment record on success.

    Returns a dict:
        {'success': True,  'payment_intent_id': str, 'demo': bool}
        {'success': False, 'error': str, 'message': str}

    error codes: 'no_payment_method' | 'card_error' | 'payment_failed' | 'stripe_error'
    """
    from accounts.models import PaymentMethod
    from .models import Payment

    stripe.api_key = settings.STRIPE_SECRET_KEY

    pm = PaymentMethod.objects.filter(user=student, is_default=True).first()
    if not pm:
        return {
            "success": False,
            "error": "no_payment_method",
            "message": "No saved payment method found. Please add a card before requesting instant help.",
        }

    # Demo / unconfigured Stripe — simulate success so dev flow still works
    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder"):
        demo_id = f"demo_instant_{session.id}"
        session.stripe_payment_intent_id = demo_id
        session.save(update_fields=["stripe_payment_intent_id"])
        Payment.objects.get_or_create(
            session=session,
            defaults={
                "payer": student,
                "recipient": session.tutor,
                "amount": session.price,
                "stripe_payment_intent_id": demo_id,
                "status": Payment.Status.SUCCEEDED,
                "invoice_number": Payment.generate_invoice_number(),
                "paid_at": timezone.now(),
            },
        )
        return {"success": True, "payment_intent_id": demo_id, "demo": True}

    try:
        customer_id = get_or_create_stripe_customer(student)

        payment_intent = stripe.PaymentIntent.create(
            amount=int(session.price * 100),  # pence
            currency="gbp",
            customer=customer_id,
            payment_method=pm.stripe_payment_method_id,
            off_session=True,
            confirm=True,
            metadata={"session_id": str(session.id)},
            description=f"Instant Tutoring Session: {session.topic}",
        )

        if payment_intent.status == "succeeded":
            session.stripe_payment_intent_id = payment_intent.id
            session.save(update_fields=["stripe_payment_intent_id"])

            Payment.objects.get_or_create(
                session=session,
                defaults={
                    "payer": student,
                    "recipient": session.tutor,
                    "amount": session.price,
                    "stripe_payment_intent_id": payment_intent.id,
                    "status": Payment.Status.SUCCEEDED,
                    "invoice_number": Payment.generate_invoice_number(),
                    "paid_at": timezone.now(),
                },
            )
            return {"success": True, "payment_intent_id": payment_intent.id, "demo": False}

        return {
            "success": False,
            "error": "payment_failed",
            "message": f"Payment did not complete (status: {payment_intent.status}). Please check your card and try again.",
        }

    except stripe.error.CardError as e:
        return {
            "success": False,
            "error": "card_error",
            "message": getattr(e, "user_message", str(e)) or "Your card was declined. Please update your payment method.",
        }
    except stripe.error.StripeError as e:
        return {
            "success": False,
            "error": "stripe_error",
            "message": str(e),
        }
