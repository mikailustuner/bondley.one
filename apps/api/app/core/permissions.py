"""Permission and role management utilities."""

from typing import Literal

# Role hierarchy: higher roles inherit permissions of lower roles
ROLE_HIERARCHY = {
    "admin": 4,
    "pro_user": 3,
    "premium_user": 2,
    "free_user": 1,
}

VALID_ROLES = Literal["admin", "premium_user", "pro_user", "free_user"]


def has_role_permission(user_role: str, required_role: str) -> bool:
    """
    Check if a user role has permission for a required role.
    Higher roles have permissions of lower roles.
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(required_role, 999)
    return user_level >= required_level


def is_admin(role: str) -> bool:
    """Check if role is admin."""
    return role == "admin"


def is_pro_user(role: str) -> bool:
    """Check if role is pro_user or admin."""
    return role in ("pro_user", "admin")


def is_premium_user(role: str) -> bool:
    """Check if role is premium_user, pro_user, or admin."""
    return role in ("premium_user", "pro_user", "admin")


def is_free_user(role: str) -> bool:
    """Check if role is free_user."""
    return role == "free_user"


def get_role_level(role: str) -> int:
    """Get the numeric level of a role."""
    return ROLE_HIERARCHY.get(role, 0)
