from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .robi import robi_score
from .serializers import RobiRequestSerializer, SinclairRequestSerializer
from .sinclair import calculate_sinclair_coefficient, calculate_sinclair_total


class SinclairView(APIView):
    def post(self, request):
        serializer = SinclairRequestSerializer(data=request.data)
        if serializer.is_valid():
            payload = serializer.validated_data
            coefficient = calculate_sinclair_coefficient(
                payload['bodyweight_kg'],
                payload['gender'],
            )
            sinclair_total = calculate_sinclair_total(
                payload['total_kg'],
                payload['bodyweight_kg'],
                payload['gender'],
            )
            return Response(
                {
                    'coefficient': round(coefficient, 4),
                    'sinclair_total': round(sinclair_total, 2),
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RobiView(APIView):
    """IWF ROBI score for one athlete's total, bracketed by current IWF WRs.

    See apps/analytics/robi.py for the formula, source citations, and the
    per-category WR table (post-2025-Worlds values).
    """

    def post(self, request):
        serializer = RobiRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        payload = serializer.validated_data
        try:
            result = robi_score(
                total_kg=payload['total_kg'],
                bodyweight_kg=payload['bodyweight_kg'],
                gender=payload['gender'],
            )
        except (ValueError, KeyError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result, status=status.HTTP_200_OK)

