from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


# UK Math Subjects
MATH_SUBJECTS = [
    ('algebra', 'Algebra'),
    ('geometry', 'Geometry'),
    ('trigonometry', 'Trigonometry'),
    ('calculus', 'Calculus'),
    ('statistics', 'Statistics'),
    ('probability', 'Probability'),
    ('number_theory', 'Number Theory'),
    ('arithmetic', 'Arithmetic'),
    ('fractions', 'Fractions & Decimals'),
    ('percentages', 'Percentages'),
    ('ratios', 'Ratios & Proportions'),
    ('equations', 'Equations'),
    ('graphs', 'Graphs & Functions'),
    ('vectors', 'Vectors'),
    ('matrices', 'Matrices'),
    ('differentiation', 'Differentiation'),
    ('integration', 'Integration'),
    ('mechanics', 'Mechanics'),
    ('pure_math', 'Pure Mathematics'),
    ('applied_math', 'Applied Mathematics'),
]

# UK Grade Levels
UK_GRADES = [
    ('year_7', 'Year 7'),
    ('year_8', 'Year 8'),
    ('year_9', 'Year 9'),
    ('year_10', 'Year 10'),
    ('year_11', 'Year 11'),
    ('gcse', 'GCSE'),
    ('year_12', 'Year 12'),
    ('year_13', 'Year 13'),
    ('as_level', 'AS Level'),
    ('a_level', 'A Level'),
    ('further_math', 'Further Mathematics'),
]


class TutorProfile(models.Model):
    """Extended profile for tutors."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tutor_profile'
    )
    bio = models.TextField(max_length=1000, blank=True)
    hourly_rate = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=25.00
    )
    subjects = models.JSONField(default=list)  # List of subject keys
    grades_taught = models.JSONField(default=list)  # List of grade keys
    qualifications = models.TextField(max_length=500, blank=True)
    profile_image = models.ImageField(
        upload_to='tutor_profiles/',
        blank=True,
        null=True
    )
    is_available_for_instant = models.BooleanField(default=False)
    is_profile_complete = models.BooleanField(default=False)
    total_sessions = models.PositiveIntegerField(default=0)
    total_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0
    )
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0
    )
    total_reviews = models.PositiveIntegerField(default=0)
    total_earnings = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    stripe_account_id = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Tutor: {self.user.email}"

    def get_subjects_display(self):
        """Return human-readable subject names."""
        subject_map = dict(MATH_SUBJECTS)
        return [subject_map.get(s, s) for s in self.subjects]

    def get_grades_display(self):
        """Return human-readable grade names."""
        grade_map = dict(UK_GRADES)
        return [grade_map.get(g, g) for g in self.grades_taught]


class StudentProfile(models.Model):
    """Extended profile for students."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    current_grade = models.CharField(
        max_length=20,
        choices=UK_GRADES,
        blank=True
    )
    subjects_needed = models.JSONField(default=list)  # List of subject keys
    learning_goals = models.TextField(max_length=500, blank=True)
    profile_image = models.ImageField(
        upload_to='student_profiles/',
        blank=True,
        null=True
    )
    is_profile_complete = models.BooleanField(default=False)
    total_sessions = models.PositiveIntegerField(default=0)
    total_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Student: {self.user.email}"


class Session(models.Model):
    """Tutoring session model."""
    
    class Status(models.TextChoices):
        PENDING_TUTOR = 'pending_tutor', 'Pending Tutor Approval'
        PENDING_PAYMENT = 'pending_payment', 'Pending Payment'
        CONFIRMED = 'confirmed', 'Confirmed'
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
        NO_SHOW = 'no_show', 'No Show'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tutor_sessions'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_sessions'
    )
    scheduled_time = models.DateTimeField()
    duration = models.PositiveIntegerField(default=60)  # Duration in minutes
    topic = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_TUTOR
    )
    meeting_link = models.URLField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True)
    is_instant = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_time']

    def __str__(self):
        return f"Session: {self.student.email} with {self.tutor.email} on {self.scheduled_time}"

    def generate_meeting_link(self):
        """Generate a Jitsi Meet link for this session."""
        room_name = f"mathmentor-{self.id}-{int(self.scheduled_time.timestamp())}"
        self.meeting_link = f"https://meet.jit.si/{room_name}"
        self.save()
        return self.meeting_link

    def can_join(self):
        """Check if the session can be joined (5 minutes before start)."""
        allowed_statuses = [
            self.Status.CONFIRMED,
            self.Status.SCHEDULED,
            self.Status.IN_PROGRESS,
        ]
        if self.status not in allowed_statuses:
            return False
        join_time = self.scheduled_time - timezone.timedelta(minutes=5)
        end_time = self.scheduled_time + timezone.timedelta(minutes=self.duration + 15)
        return join_time <= timezone.now() <= end_time


class SessionReview(models.Model):
    """Review for a completed session."""
    session = models.OneToOneField(
        Session,
        on_delete=models.CASCADE,
        related_name='review'
    )
    rating = models.PositiveIntegerField()  # 1-5
    comment = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review for {self.session}: {self.rating}/5"

    def save(self, *args, **kwargs):
        # Update tutor's average rating
        super().save(*args, **kwargs)
        tutor_profile = self.session.tutor.tutor_profile
        reviews = SessionReview.objects.filter(session__tutor=self.session.tutor)
        tutor_profile.total_reviews = reviews.count()
        tutor_profile.average_rating = reviews.aggregate(
            models.Avg('rating')
        )['rating__avg'] or 0
        tutor_profile.save()


class Conversation(models.Model):
    """Conversation between two users."""
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='conversations'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        participant_emails = ", ".join([p.email for p in self.participants.all()])
        return f"Conversation: {participant_emails}"

    def get_other_participant(self, user):
        """Get the other participant in the conversation."""
        return self.participants.exclude(id=user.id).first()


class Message(models.Model):
    """Chat message model."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.email}: {self.content[:50]}"
    
    @property
    def status(self):
        """Get message delivery status."""
        if self.is_read and self.read_at:
            return 'read'
        elif self.delivered_at:
            return 'delivered'
        return 'sent'


class InstantRequest(models.Model):
    """Request for instant tutoring (Uber-style matching)."""
    
    class Status(models.TextChoices):
        SEARCHING = 'searching', 'Searching for Tutor'
        MATCHED = 'matched', 'Matched with Tutor'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        EXPIRED = 'expired', 'Expired'
        CANCELLED = 'cancelled', 'Cancelled'
        IN_SESSION = 'in_session', 'In Session'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='instant_requests'
    )
    subject = models.CharField(max_length=50, choices=MATH_SUBJECTS)
    grade = models.CharField(max_length=20, choices=UK_GRADES)
    topic_description = models.TextField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SEARCHING
    )
    matched_tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matched_instant_requests'
    )
    session = models.OneToOneField(
        Session,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='instant_request'
    )
    notified_tutors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='notified_instant_requests',
        blank=True
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Instant Request: {self.student.email} - {self.subject} ({self.grade})"

    def is_expired(self):
        return timezone.now() > self.expires_at


class TutorAvailability(models.Model):
    """Tutor's availability schedule."""
    
    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, 'Monday'
        TUESDAY = 1, 'Tuesday'
        WEDNESDAY = 2, 'Wednesday'
        THURSDAY = 3, 'Thursday'
        FRIDAY = 4, 'Friday'
        SATURDAY = 5, 'Saturday'
        SUNDAY = 6, 'Sunday'

    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    day_of_week = models.IntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']
        verbose_name_plural = 'Tutor availabilities'

    def __str__(self):
        return f"{self.tutor.email} - {self.get_day_of_week_display()}: {self.start_time} - {self.end_time}"
