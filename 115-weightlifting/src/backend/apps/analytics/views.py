from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SinclairRequestSerializer
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

