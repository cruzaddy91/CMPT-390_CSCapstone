from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import TrainingProgram, default_program_data

User = get_user_model()


def _plain_text_no_markup(value, field_label):
    """Reject angle brackets in user-facing text fields (XSS / UI confusion)."""
    if value in (None, ''):
        return value
    text = str(value)
    if '<' in text or '>' in text:
        raise serializers.ValidationError(
            f'{field_label} cannot contain "<" or ">".'
        )
    return text


def normalize_program_data(value):
    if value in (None, ''):
        value = default_program_data()

    if not isinstance(value, dict):
        raise serializers.ValidationError('program_data must be an object.')

    # Coach display preference for intensity columns (% 1RM / RPE / weight).
    # Persisted so reopening a program restores the mode; frontend-only signal,
    # doesn't affect stored prescription data.
    intensity_mode = value.get('intensity_mode')
    if intensity_mode not in ('percent_1rm', 'rpe', 'weight'):
        intensity_mode = None

    normalized = {
        'week_start_date': str(value.get('week_start_date', '')),
        'days': [],
    }
    if intensity_mode:
        normalized['intensity_mode'] = intensity_mode

    days = value.get('days', [])
    if not isinstance(days, list):
        raise serializers.ValidationError('program_data.days must be a list.')

    for index, day in enumerate(days):
        if not isinstance(day, dict):
            raise serializers.ValidationError(f'program_data.days[{index}] must be an object.')

        exercises = day.get('exercises', [])
        if not isinstance(exercises, list):
            raise serializers.ValidationError(f'program_data.days[{index}].exercises must be a list.')

        # Preserve stable per-day id so athlete completion records survive day
        # reorder / rename. Frontend provides the id; fall back to a
        # position-based default so legacy programs still get a usable id.
        day_id = day.get('id')
        if not isinstance(day_id, str) or not day_id:
            day_id = f'd{index}'

        normalized_day = {
            'id': day_id,
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
                    # Legacy combined intensity kept for backwards-compat with
                    # older frontends / consumers; new clients should prefer
                    # the explicit percent_1rm / rpe / weight fields below.
                    'intensity': str(exercise.get('intensity', '')),
                    'percent_1rm': str(exercise.get('percent_1rm', '')),
                    'rpe': str(exercise.get('rpe', '')),
                    'weight': str(exercise.get('weight', '')),
                    'tempo': str(exercise.get('tempo', '')),
                    'rest': str(exercise.get('rest', '')),
                    'week': str(exercise.get('week', '')),
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
    completion_data = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProgram
        fields = [
            'id',
            'name',
            'description',
            'start_date',
            'end_date',
            'program_data',
            'completion_data',
            'coach_id',
            'coach_username',
            'athlete_id',
            'athlete_username',
            'created_at',
            'updated_at',
        ]

    def get_completion_data(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        athlete_id = request.user.id if request.user.user_type == 'athlete' else obj.athlete_id
        if obj.athlete_id != athlete_id and request.user.user_type != 'coach':
            return None
        target_athlete = athlete_id if request.user.user_type == 'athlete' else obj.athlete_id
        for record in getattr(obj, 'completion_records').all() if hasattr(obj, 'completion_records') else []:
            if record.athlete_id == target_athlete:
                return record.completion_data
        return None


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

    def validate_name(self, value):
        return _plain_text_no_markup(value, 'Program name')

    def validate_description(self, value):
        return _plain_text_no_markup(value, 'Description')

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

    def validate_name(self, value):
        return _plain_text_no_markup(value, 'Program name')

    def validate_description(self, value):
        return _plain_text_no_markup(value, 'Description')

    def update(self, instance, validated_data):
        athlete_id = validated_data.pop('athlete_id', None)
        if athlete_id is not None:
            instance.athlete = User.objects.get(id=athlete_id, user_type='athlete')

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()
        return instance
