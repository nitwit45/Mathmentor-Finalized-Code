from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """
    Allows access only to admin users.

    Admin is defined as either:
    - Django superuser (is_superuser=True), or
    - User role explicitly set to ADMIN.
    """

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        # Superusers are always admins
        if getattr(user, "is_superuser", False):
            return True
        # Fallback to role check if present
        return getattr(user, "role", None) == getattr(
            getattr(user, "Role", None), "ADMIN", "ADMIN"
        )

