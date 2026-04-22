"""Role helpers for coach / head coach / athlete authorization."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


def is_head_coach(user: AbstractUser) -> bool:
    return getattr(user, 'user_type', None) == 'head_coach'


def is_line_coach(user: AbstractUser) -> bool:
    """Coach or head coach — may own training programs."""
    return getattr(user, 'user_type', None) in ('coach', 'head_coach')


def is_athlete(user: AbstractUser) -> bool:
    return getattr(user, 'user_type', None) == 'athlete'


def staff_coach_queryset(head):
    """Line coaches reporting to this head coach (not including the head)."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.filter(reports_to=head, user_type='coach')
