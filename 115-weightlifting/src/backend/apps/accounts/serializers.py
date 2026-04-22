import os

from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    coach_signup_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'user_type', 'coach_signup_code']

    def validate(self, attrs):
        user_type = attrs.get('user_type')
        submitted_code = (attrs.get('coach_signup_code') or '').strip()
        if user_type == 'coach':
            expected = (os.getenv('COACH_SIGNUP_CODE') or '').strip()
            if not expected:
                raise serializers.ValidationError({
                    'user_type': 'Coach registration is disabled until COACH_SIGNUP_CODE is configured.'
                })
            if submitted_code != expected:
                raise serializers.ValidationError({
                    'coach_signup_code': 'Invalid coach signup code.'
                })
        return attrs

    def create(self, validated_data):
        validated_data.pop('coach_signup_code', None)
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            user_type=validated_data['user_type'],
        )
        return user


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'user_type']
