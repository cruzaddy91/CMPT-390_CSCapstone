from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import TrainingProgram, default_program_data

User = get_user_model()


def normalize_program_data(value):
    if value in (None, ''):
        value = default_program_data()

    if not isinstance(value, dict):
        raise serializers.ValidationError('program_data must be an object.')

    normalized = {
        'week_start_date': str(value.get('week_start_date', '')),
        'days': [],
    }

    days = value.get('days', [])
    if not isinstance(days, list):
        raise serializers.ValidationError('program_data.days must be a list.')

    for index, day in enumerate(days):
        if not isinstance(day, dict):
            raise serializers.ValidationError(f'program_data.days[{index}] must be an object.')

        exercises = day.get('exercises', [])
        if not isinstance(exercises, list):
            raise serializers.ValidationError(f'program_data.days[{index}].exercises must be a list.')

        normalized_day = {
            'day': str(day.get('day') or f'Day {index + 1}'),
            'exercises': [],
        }

        for exercise_index, exercise in enumerate(exercises):
            if not isinstance(exercise, dict):
                raise serializers.ValidationError(
                    f'program_data.days[{index}].exercises[{exercise_index}] must be an object.'
                )
            normalized_day['exercises'].append(
                {
                    'name': str(exercise.get('name', '')),
                    'sets': str(exercise.get('sets', '')),
                    'reps': str(exercise.get('reps', '')),
                    'intensity': str(exercise.get('intensity', '')),
                    'notes': str(exercise.get('notes', '')),
                }
            )

        normalized['days'].append(normalized_day)

    return normalized


class TrainingProgramSerializer(serializers.ModelSerializer):
    coach_id = serializers.IntegerField(source='coach.id', read_only=True)
    coach_username = serializers.CharField(source='coach.username', read_only=True)
    athlete_id = serializers.IntegerField(source='athlete.id', read_only=True)
    athlete_username = serializers.CharField(source='athlete.username', read_only=True)

    class Meta:
        model = TrainingProgram
        fields = [
            'id',
            'name',
            'description',
            'start_date',
            'end_date',
            'program_data',
            'coach_id',
            'coach_username',
            'athlete_id',
            'athlete_username',
            'created_at',
            'updated_at',
        ]


class ProgramCreateSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(write_only=True)
    program_data = serializers.JSONField(required=False)

    class Meta:
        model = TrainingProgram
        fields = ['id', 'name', 'description', 'start_date', 'end_date', 'athlete_id', 'program_data']

    def validate_athlete_id(self, value):
        try:
            athlete = User.objects.get(id=value, user_type='athlete')
        except User.DoesNotExist:
            raise serializers.ValidationError('Selected athlete does not exist.')
        return athlete.id

    def validate_program_data(self, value):
        return normalize_program_data(value)

    def create(self, validated_data):
        athlete_id = validated_data.pop('athlete_id')
        athlete = User.objects.get(id=athlete_id, user_type='athlete')
        coach = self.context['request'].user
        return TrainingProgram.objects.create(coach=coach, athlete=athlete, **validated_data)


class ProgramUpdateSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(write_only=True, required=False)
    program_data = serializers.JSONField(required=False)

    class Meta:
        model = TrainingProgram
        fields = ['name', 'description', 'start_date', 'end_date', 'athlete_id', 'program_data']
        extra_kwargs = {
            'name': {'required': False},
            'description': {'required': False},
            'start_date': {'required': False},
            'end_date': {'required': False, 'allow_null': True},
        }

    def validate_athlete_id(self, value):
        try:
            athlete = User.objects.get(id=value, user_type='athlete')
        except User.DoesNotExist:
            raise serializers.ValidationError('Selected athlete does not exist.')
        return athlete.id

    def validate_program_data(self, value):
        return normalize_program_data(value)

    def update(self, instance, validated_data):
        athlete_id = validated_data.pop('athlete_id', None)
        if athlete_id is not None:
            instance.athlete = User.objects.get(id=athlete_id, user_type='athlete')

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()
        return instance
