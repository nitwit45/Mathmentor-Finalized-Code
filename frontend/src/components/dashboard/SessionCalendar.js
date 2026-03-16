import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getCalendarSessions } from '../../services/api';
import {
  HiChevronLeft,
  HiChevronRight,
  HiCalendar,
  HiClock,
  HiBookOpen,
  HiLightningBolt,
} from 'react-icons/hi';
import './SessionCalendar.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', className: 'status-scheduled' },
  confirmed: { label: 'Confirmed', className: 'status-confirmed' },
  in_progress: { label: 'In Progress', className: 'status-in-progress' },
  completed: { label: 'Completed', className: 'status-completed' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
  pending_tutor: { label: 'Pending', className: 'status-pending' },
  pending_payment: { label: 'Pending Payment', className: 'status-pending' },
  no_show: { label: 'No Show', className: 'status-cancelled' },
};

function buildCalendarGrid(year, month, daysInMonth) {
  // month is 1-indexed; JS Date month is 0-indexed
  const firstDay = new Date(year, month - 1, 1).getDay();
  // Convert Sunday=0 to Mon-first: Monday=0 ... Sunday=6
  const startOffset = (firstDay + 6) % 7;

  const cells = [];
  // Leading empty cells
  for (let i = 0; i < startOffset; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing empty cells to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isToday(year, month, day) {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

function isPast(year, month, day) {
  const now = new Date();
  const cell = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return cell < today;
}

export default function SessionCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState(null);

  const basePath = user?.role === 'TUTOR' ? '/tutor' : '/student';

  const loadCalendar = useCallback(async (month, year) => {
    setLoading(true);
    setSelectedDay(null);
    setError(null);
    try {
      const res = await getCalendarSessions(month, year);
      if (res.success) {
        setCalendarData(res.data);
        setError(null);
      } else {
        setError(res.message || 'Failed to load calendar');
      }
    } catch (err) {
      console.error('Failed to load calendar:', err);
      setError(err.message || 'Failed to load calendar. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar(currentMonth, currentYear);
  }, [currentMonth, currentYear, loadCalendar]);

  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  }

  function goToToday() {
    const n = new Date();
    setCurrentMonth(n.getMonth() + 1);
    setCurrentYear(n.getFullYear());
  }

  const sessionsByDate = calendarData?.sessions_by_date || {};
  const daysInMonth = calendarData?.days_in_month || 31;
  const totalSessions = calendarData?.total_sessions || 0;
  const calendarCells = buildCalendarGrid(currentYear, currentMonth, daysInMonth);

  // Stats
  const upcomingCount = Object.values(sessionsByDate).flat().filter(
    s => ['scheduled', 'confirmed', 'pending_payment'].includes(s.status)
  ).length;
  const completedCount = Object.values(sessionsByDate).flat().filter(
    s => s.status === 'completed'
  ).length;
  const totalHours = Object.values(sessionsByDate).flat().reduce(
    (acc, s) => acc + (s.duration || 0), 0
  ) / 60;

  const selectedDateKey = selectedDay
    ? toDateKey(currentYear, currentMonth, selectedDay)
    : null;
  const selectedSessions = selectedDateKey ? (sessionsByDate[selectedDateKey] || []) : [];

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1>Session Calendar</h1>
        <p>Your tutoring schedule at a glance</p>
      </div>

      {/* Summary stats */}
      <div className="calendar-stats">
        <div className="cal-stat-card">
          <div className="cal-stat-icon"><HiCalendar /></div>
          <div className="cal-stat-body">
            <span className="cal-stat-value">{totalSessions}</span>
            <span className="cal-stat-label">Sessions this month</span>
          </div>
        </div>
        <div className="cal-stat-card">
          <div className="cal-stat-icon upcoming"><HiLightningBolt /></div>
          <div className="cal-stat-body">
            <span className="cal-stat-value">{upcomingCount}</span>
            <span className="cal-stat-label">Upcoming</span>
          </div>
        </div>
        <div className="cal-stat-card">
          <div className="cal-stat-icon completed"><HiBookOpen /></div>
          <div className="cal-stat-body">
            <span className="cal-stat-value">{completedCount}</span>
            <span className="cal-stat-label">Completed</span>
          </div>
        </div>
        <div className="cal-stat-card">
          <div className="cal-stat-icon hours"><HiClock /></div>
          <div className="cal-stat-body">
            <span className="cal-stat-value">{totalHours.toFixed(1)}h</span>
            <span className="cal-stat-label">Hours scheduled</span>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        {/* Calendar header */}
        <div className="calendar-header">
          <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
            <HiChevronLeft />
          </button>
          <div className="cal-header-center">
            <h2 className="cal-month-title">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h2>
            <button className="today-btn" onClick={goToToday}>Today</button>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
            <HiChevronRight />
          </button>
        </div>

        {/* Day of week labels */}
        <div className="cal-weekdays">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="cal-weekday">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="cal-loading">
            <div className="loading-spinner"></div>
            <p>Loading calendar...</p>
          </div>
        ) : error ? (
          <div className="cal-error">
            <p className="cal-error-message">{error}</p>
            <button type="button" className="cal-retry-btn" onClick={() => loadCalendar(currentMonth, currentYear)}>
              Try again
            </button>
          </div>
        ) : (
          <div className="cal-grid">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="cal-cell cal-cell--empty" />;
              }
              const dateKey = toDateKey(currentYear, currentMonth, day);
              const daySessions = sessionsByDate[dateKey] || [];
              const today = isToday(currentYear, currentMonth, day);
              const past = isPast(currentYear, currentMonth, day);
              const selected = selectedDay === day;

              return (
                <div
                  key={day}
                  className={[
                    'cal-cell',
                    today ? 'cal-cell--today' : '',
                    past ? 'cal-cell--past' : '',
                    selected ? 'cal-cell--selected' : '',
                    daySessions.length > 0 ? 'cal-cell--has-sessions' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(selected ? null : day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedDay(selected ? null : day)}
                >
                  <span className="cal-day-number">{day}</span>
                  <div className="cal-session-dots">
                    {daySessions.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className={`cal-dot ${STATUS_CONFIG[s.status]?.className || ''}`}
                        title={s.topic}
                      />
                    ))}
                    {daySessions.length > 3 && (
                      <span className="cal-dot-more">+{daySessions.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="cal-legend">
          <span className="legend-item"><span className="cal-dot status-scheduled" /> Scheduled</span>
          <span className="legend-item"><span className="cal-dot status-confirmed" /> Confirmed</span>
          <span className="legend-item"><span className="cal-dot status-in-progress" /> In Progress</span>
          <span className="legend-item"><span className="cal-dot status-completed" /> Completed</span>
          <span className="legend-item"><span className="cal-dot status-cancelled" /> Cancelled</span>
          <span className="legend-item"><span className="cal-dot status-pending" /> Pending</span>
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="cal-day-panel">
          <div className="cal-day-panel-header">
            <h3>
              {MONTH_NAMES[currentMonth - 1]} {selectedDay}, {currentYear}
            </h3>
            <span className="cal-day-session-count">
              {selectedSessions.length} session{selectedSessions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedSessions.length === 0 ? (
            <div className="cal-day-empty">
              <p>No sessions on this day</p>
            </div>
          ) : (
            <div className="cal-day-sessions">
              {selectedSessions.map(session => {
                const statusCfg = STATUS_CONFIG[session.status] || {};
                const otherPerson = user?.role === 'TUTOR'
                  ? session.student_name
                  : session.tutor_name;
                return (
                  <div
                    key={session.id}
                    className="cal-session-card"
                    onClick={() => navigate(`${basePath}/sessions/${session.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`${basePath}/sessions/${session.id}`)}
                  >
                    <div className={`cal-session-status-bar ${statusCfg.className || ''}`} />
                    <div className="cal-session-info">
                      <div className="cal-session-main">
                        <h4 className="cal-session-topic">{session.topic}</h4>
                        <p className="cal-session-with">with {otherPerson}</p>
                      </div>
                      <div className="cal-session-meta">
                        <span className="cal-session-time">
                          <HiClock /> {formatTime(session.scheduled_time)}
                        </span>
                        <span className="cal-session-duration">{session.duration} min</span>
                        <span className={`cal-session-badge ${statusCfg.className || ''}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
