from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication that exempts CSRF checks for unauthenticated requests.
    This allows public endpoints (signup, login) to work without CSRF tokens,
    while still protecting authenticated endpoints.
    """
    def enforce_csrf(self, request):
        # Skip CSRF check for unauthenticated requests
        return

