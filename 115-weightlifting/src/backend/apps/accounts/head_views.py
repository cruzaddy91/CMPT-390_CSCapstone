"""Head-coach-only org overview (compare staff coaches)."""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.accounts.roles import is_head_coach, staff_coach_queryset
from apps.athletes.models import PersonalRecord, WorkoutLog
from apps.programs.models import TrainingProgram


class HeadOrgSummaryView(APIView):
    """Per-coach rollups for this head coach's org (staff + self)."""

    def get(self, request):
        if not is_head_coach(request.user):
            return Response(
                {'detail': 'Only head coaches can view org summary.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        head = request.user
        coaches = [head, *list(staff_coach_queryset(head).order_by('username'))]
        out = []
        for coach in coaches:
            athlete_ids = list(
                TrainingProgram.objects.filter(coach=coach)
                .values_list('athlete_id', flat=True)
                .distinct()
            )
            athlete_set = set(athlete_ids)
            pr_qs = PersonalRecord.objects.filter(athlete_id__in=athlete_ids) if athlete_ids else PersonalRecord.objects.none()
            wl_qs = WorkoutLog.objects.filter(athlete_id__in=athlete_ids) if athlete_ids else WorkoutLog.objects.none()
            out.append(
                {
                    'id': coach.id,
                    'username': coach.username,
                    'user_type': coach.user_type,
                    'athlete_count': len(athlete_set),
                    'program_count': TrainingProgram.objects.filter(coach=coach).count(),
                    'personal_record_count': pr_qs.count(),
                    'workout_log_count': wl_qs.count(),
                }
            )
        return Response({'coaches': out}, status=status.HTTP_200_OK)
