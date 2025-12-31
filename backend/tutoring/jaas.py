"""
JaaS (Jitsi as a Service) JWT Generation Utility

Generates signed JWTs for authenticating users in JaaS video sessions.
"""

import jwt
import uuid
from datetime import datetime, timedelta
from django.conf import settings


def load_private_key():
    """Load the JaaS private key from file."""
    with open(settings.JAAS_PRIVATE_KEY_PATH, 'r') as key_file:
        return key_file.read()


def generate_jaas_jwt(user, room_name, is_moderator=False, duration_minutes=60):
    """
    Generate a JaaS JWT for a user to join a video session.
    
    Args:
        user: The Django user object
        room_name: The unique room name for the session
        is_moderator: Whether the user should have moderator privileges
        duration_minutes: Session duration (used to calculate token expiry)
    
    Returns:
        str: Signed JWT token
    """
    private_key = load_private_key()
    
    now = datetime.utcnow()
    # Token expires after session duration + 30 min buffer
    exp = now + timedelta(minutes=duration_minutes + 30)
    
    # Generate unique user ID - JaaS requires longer IDs
    # Using format: mathmentor|{user_id}|{uuid} for uniqueness
    user_id = f"mathmentor|{user.id}|{uuid.uuid4().hex[:12]}"
    
    # Build the JWT payload according to JaaS spec
    payload = {
        'aud': 'jitsi',
        'iss': 'chat',
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
        'nbf': int((now - timedelta(seconds=10)).timestamp()),
        'sub': settings.JAAS_APP_ID,
        'room': '*',  # Allow access to any room (room is specified in roomName)
        'context': {
            'features': {
                'livestreaming': False,
                'outbound-call': False,
                'sip-outbound-call': False,
                'transcription': False,
                'recording': False,
            },
            'user': {
                'id': user_id,
                'name': f"{user.first_name} {user.last_name}".strip() or user.email,
                'email': user.email,
                'avatar': '',  # Could add profile image URL here
                'moderator': is_moderator,
                'hidden-from-recorder': False,
            },
        },
    }
    
    # Sign the token with RS256
    headers = {
        'kid': settings.JAAS_API_KEY_ID,
        'typ': 'JWT',
        'alg': 'RS256',
    }
    
    token = jwt.encode(
        payload,
        private_key,
        algorithm='RS256',
        headers=headers,
    )
    
    return token


def generate_room_name(session_id):
    """
    Generate a unique JaaS room name for a session.
    
    Args:
        session_id: The UUID of the tutoring session
    
    Returns:
        str: Full room name in format AppID/RoomName
    """
    # Create a readable room name from session ID
    room_suffix = f"mathmentor-{str(session_id).replace('-', '')[:16]}"
    return f"{settings.JAAS_APP_ID}/{room_suffix}"

