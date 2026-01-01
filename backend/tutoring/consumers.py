import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from datetime import timedelta


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat."""

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Verify user is a participant in the conversation
        is_participant = await self.is_conversation_participant()
        if not is_participant:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type', 'message')

        if message_type == 'message':
            content = data.get('content', '')
            if content:
                # Save message to database
                message = await self.save_message(content)
                
                # Broadcast to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': {
                            'id': str(message.id),
                            'content': message.content,
                            'sender_id': message.sender.id,
                            'sender_name': f"{message.sender.first_name} {message.sender.last_name}",
                            'created_at': message.created_at.isoformat(),
                            'is_read': message.is_read,
                            'delivered_at': None,
                            'read_at': None,
                            'status': 'sent',
                        }
                    }
                )

        elif message_type == 'delivered_ack':
            # Mark message as delivered
            message_id = data.get('message_id')
            if message_id:
                delivered_at = await self.mark_message_delivered(message_id)
                if delivered_at:
                    # Broadcast delivery status to sender
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'message_status_update',
                            'message_id': message_id,
                            'status': 'delivered',
                            'delivered_at': delivered_at,
                        }
                    )

        elif message_type == 'typing':
            # Broadcast typing indicator
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': self.user.id,
                    'is_typing': data.get('is_typing', False),
                }
            )

        elif message_type == 'read':
            # Mark messages as read
            message_ids = data.get('message_ids', [])
            if message_ids:
                read_at = await self.mark_messages_read(message_ids)
                if read_at:
                    # Broadcast read status to sender
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'message_status_update',
                            'message_ids': message_ids,
                            'status': 'read',
                            'read_at': read_at,
                        }
                    )

    async def chat_message(self, event):
        """Send message to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    async def message_status_update(self, event):
        """Send message status update to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'message_id': event.get('message_id'),
            'message_ids': event.get('message_ids'),
            'status': event['status'],
            'delivered_at': event.get('delivered_at'),
            'read_at': event.get('read_at'),
        }))

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket."""
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing'],
            }))

    @database_sync_to_async
    def is_conversation_participant(self):
        from .models import Conversation
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            return self.user in conversation.participants.all()
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content):
        from .models import Message, Conversation
        conversation = Conversation.objects.get(id=self.conversation_id)
        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content
        )
        # Update conversation timestamp
        conversation.updated_at = timezone.now()
        conversation.save()
        return message

    @database_sync_to_async
    def mark_message_delivered(self, message_id):
        from .models import Message
        try:
            message = Message.objects.get(id=message_id)
            # Only mark as delivered if it's not already delivered
            if not message.delivered_at:
                message.delivered_at = timezone.now()
                message.save()
                return message.delivered_at.isoformat()
        except Message.DoesNotExist:
            pass
        return None

    @database_sync_to_async
    def mark_messages_read(self, message_ids):
        from .models import Message, Conversation
        conversation = Conversation.objects.get(id=self.conversation_id)
        messages = Message.objects.filter(
            id__in=message_ids,
            conversation=conversation
        ).exclude(
            sender=self.user
        )
        
        read_at = timezone.now()
        messages.update(is_read=True, read_at=read_at)
        return read_at.isoformat() if messages.exists() else None


class InstantMatchConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for instant tutoring matching (Uber-style)."""

    async def connect(self):
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Add user to their personal notification group
        self.user_group = f'user_{self.user.id}'
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )

        # If tutor and available, add to instant matching pool
        if await self.is_available_tutor():
            self.tutor_subjects = await self.get_tutor_subjects()
            for subject in self.tutor_subjects:
                await self.channel_layer.group_add(
                    f'instant_{subject}',
                    self.channel_name
                )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group,
            self.channel_name
        )

        # Remove from subject groups if tutor
        if hasattr(self, 'tutor_subjects'):
            for subject in self.tutor_subjects:
                await self.channel_layer.group_discard(
                    f'instant_{subject}',
                    self.channel_name
                )

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'request_tutor':
            # Student requesting instant tutoring
            await self.handle_tutor_request(data)

        elif action == 'accept_request':
            # Tutor accepting a request
            await self.handle_accept_request(data)

        elif action == 'decline_request':
            # Tutor declining a request
            await self.handle_decline_request(data)

        elif action == 'cancel_request':
            # Student cancelling their request
            await self.handle_cancel_request(data)

        elif action == 'toggle_availability':
            # Tutor toggling their availability
            await self.handle_toggle_availability(data)

    async def handle_tutor_request(self, data):
        """Handle a student's request for instant tutoring."""
        subject = data.get('subject')
        grade = data.get('grade')
        topic = data.get('topic', '')

        # Create instant request in database
        request_data = await self.create_instant_request(subject, grade, topic)

        if request_data:
            # Notify user their request is being processed
            await self.send(text_data=json.dumps({
                'type': 'request_created',
                'request_id': str(request_data['id']),
                'status': 'searching',
            }))

            # Broadcast to all available tutors with matching subject
            await self.channel_layer.group_send(
                f'instant_{subject}',
                {
                    'type': 'instant_request',
                    'request': {
                        'id': str(request_data['id']),
                        'student_name': request_data['student_name'],
                        'subject': subject,
                        'grade': grade,
                        'topic': topic,
                        'expires_at': request_data['expires_at'],
                    }
                }
            )

    async def handle_accept_request(self, data):
        """Handle tutor accepting an instant request."""
        request_id = data.get('request_id')
        result = await self.accept_instant_request(request_id)

        if result['success']:
            # Broadcast to all tutors in the subject group that the request is taken
            await self.channel_layer.group_send(
                f'instant_{result["subject"]}',
                {
                    'type': 'request_taken',
                    'request_id': request_id,
                }
            )

            # Notify the tutor
            await self.send(text_data=json.dumps({
                'type': 'request_accepted',
                'session': result['session'],
            }))

            # Notify the student
            await self.channel_layer.group_send(
                f"user_{result['student_id']}",
                {
                    'type': 'match_found',
                    'session': result['session'],
                    'tutor': result['tutor'],
                }
            )
        else:
            await self.send(text_data=json.dumps({
                'type': 'accept_failed',
                'request_id': request_id,
                'message': result.get('message', 'Request no longer available'),
            }))

    async def handle_decline_request(self, data):
        """Handle tutor declining an instant request."""
        request_id = data.get('request_id')
        await self.decline_instant_request(request_id)

    async def handle_cancel_request(self, data):
        """Handle student cancelling their request."""
        request_id = data.get('request_id')
        request = await self.cancel_instant_request(request_id)

        if request:
            # Broadcast cancellation to all tutors in the subject group
            await self.channel_layer.group_send(
                f'instant_{request.subject}',
                {
                    'type': 'request_cancelled',
                    'request_id': str(request_id),
                }
            )

        await self.send(text_data=json.dumps({
            'type': 'request_cancelled',
            'request_id': request_id,
        }))

    async def handle_toggle_availability(self, data):
        """Handle tutor toggling their availability."""
        is_available = data.get('is_available', False)
        await self.set_tutor_availability(is_available)

        if is_available:
            self.tutor_subjects = await self.get_tutor_subjects()
            for subject in self.tutor_subjects:
                await self.channel_layer.group_add(
                    f'instant_{subject}',
                    self.channel_name
                )
        else:
            if hasattr(self, 'tutor_subjects'):
                for subject in self.tutor_subjects:
                    await self.channel_layer.group_discard(
                        f'instant_{subject}',
                        self.channel_name
                    )

        await self.send(text_data=json.dumps({
            'type': 'availability_updated',
            'is_available': is_available,
        }))

    async def instant_request(self, event):
        """Send instant request notification to tutor."""
        await self.send(text_data=json.dumps({
            'type': 'instant_request',
            'request': event['request']
        }))

    async def match_found(self, event):
        """Notify student that a tutor was found."""
        await self.send(text_data=json.dumps({
            'type': 'match_found',
            'session': event['session'],
            'tutor': event['tutor'],
        }))

    async def request_cancelled(self, event):
        """Notify tutor that a request was cancelled."""
        await self.send(text_data=json.dumps({
            'type': 'request_cancelled',
            'request_id': event['request_id'],
        }))

    async def request_taken(self, event):
        """Notify tutor that a request was taken by another tutor."""
        await self.send(text_data=json.dumps({
            'type': 'request_taken',
            'request_id': event['request_id'],
        }))

    @database_sync_to_async
    def is_available_tutor(self):
        from .models import TutorProfile
        if self.user.role != 'TUTOR':
            return False
        try:
            profile = TutorProfile.objects.get(user=self.user)
            return profile.is_available_for_instant and profile.is_profile_complete
        except TutorProfile.DoesNotExist:
            return False

    @database_sync_to_async
    def get_tutor_subjects(self):
        from .models import TutorProfile
        try:
            profile = TutorProfile.objects.get(user=self.user)
            return profile.subjects
        except TutorProfile.DoesNotExist:
            return []

    @database_sync_to_async
    def set_tutor_availability(self, is_available):
        from .models import TutorProfile
        TutorProfile.objects.filter(user=self.user).update(
            is_available_for_instant=is_available
        )

    @database_sync_to_async
    def create_instant_request(self, subject, grade, topic):
        from .models import InstantRequest
        expires_at = timezone.now() + timedelta(minutes=5)
        request = InstantRequest.objects.create(
            student=self.user,
            subject=subject,
            grade=grade,
            topic_description=topic,
            expires_at=expires_at,
        )
        return {
            'id': request.id,
            'student_name': f"{self.user.first_name} {self.user.last_name}",
            'expires_at': expires_at.isoformat(),
        }

    @database_sync_to_async
    def accept_instant_request(self, request_id):
        from .models import InstantRequest, Session, TutorProfile
        from django.db import transaction

        try:
            with transaction.atomic():
                request = InstantRequest.objects.select_for_update().get(
                    id=request_id,
                    status='searching'
                )

                if request.is_expired():
                    return {'success': False, 'message': 'Request has expired'}

                # Get tutor profile for hourly rate
                tutor_profile = TutorProfile.objects.get(user=self.user)

                # Create session
                session = Session.objects.create(
                    tutor=self.user,
                    student=request.student,
                    scheduled_time=timezone.now(),
                    duration=60,
                    topic=request.topic_description or f"{request.get_subject_display()} - {request.get_grade_display()}",
                    status=Session.Status.IN_PROGRESS,
                    price=tutor_profile.hourly_rate,
                    is_instant=True,
                )
                session.generate_meeting_link()

                # Update instant request
                request.status = InstantRequest.Status.ACCEPTED
                request.matched_tutor = self.user
                request.session = session
                request.save()

                return {
                    'success': True,
                    'student_id': request.student.id,
                    'subject': request.subject,
                    'session': {
                        'id': str(session.id),
                        'meeting_link': session.meeting_link,
                        'topic': session.topic,
                    },
                    'tutor': {
                        'id': self.user.id,
                        'name': f"{self.user.first_name} {self.user.last_name}",
                    }
                }

        except InstantRequest.DoesNotExist:
            return {'success': False, 'message': 'Request not found or already taken'}

    @database_sync_to_async
    def decline_instant_request(self, request_id):
        from .models import InstantRequest
        try:
            request = InstantRequest.objects.get(id=request_id)
            request.notified_tutors.add(self.user)
        except InstantRequest.DoesNotExist:
            pass

    @database_sync_to_async
    def cancel_instant_request(self, request_id):
        from .models import InstantRequest
        try:
            request = InstantRequest.objects.get(
                id=request_id,
                student=self.user,
                status='searching'
            )
            request.status = InstantRequest.Status.CANCELLED
            request.save()
            return request
        except InstantRequest.DoesNotExist:
            return None


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for general notifications."""

    async def connect(self):
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        self.user_group = f'notifications_{self.user.id}'
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group,
            self.channel_name
        )

    async def notification(self, event):
        """Send notification to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': event['notification']
        }))

    async def session_reminder(self, event):
        """Send session reminder."""
        await self.send(text_data=json.dumps({
            'type': 'session_reminder',
            'session': event['session']
        }))

    async def new_message(self, event):
        """Send new message notification."""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message']
        }))

    async def booking_update(self, event):
        """Send booking status update."""
        await self.send(text_data=json.dumps({
            'type': 'booking_update',
            'booking': event['booking']
        }))

