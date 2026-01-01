import { useState, useEffect } from 'react';
import { getMyAvailability, addAvailability, deleteAvailability } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import './Availability.css';

const DAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

function Availability() {
  const { showConfirm } = useToast();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    day_of_week: 0,
    start_time: '09:00',
    end_time: '17:00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const response = await getMyAvailability();
      if (response.success) {
        setAvailabilities(response.data);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.start_time >= formData.end_time) {
      setError('End time must be after start time');
      return;
    }

    setSubmitting(true);
    try {
      const response = await addAvailability(formData);
      if (response.success) {
        setAvailabilities(prev => [...prev, response.data]);
        setShowForm(false);
        setFormData({ day_of_week: 0, start_time: '09:00', end_time: '17:00' });
      }
    } catch (error) {
      setError(error.message || 'Failed to add availability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Remove this availability slot?');
    if (!confirmed) return;

    try {
      const response = await deleteAvailability(id);
      if (response.success) {
        setAvailabilities(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
    }
  };

  const groupByDay = (items) => {
    const groups = {};
    DAYS.forEach(day => {
      groups[day.value] = items.filter(a => a.day_of_week === day.value);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading availability...</p>
      </div>
    );
  }

  const groupedAvailabilities = groupByDay(availabilities);

  return (
    <div className="availability-page">
      <div className="page-header">
        <h1>Availability</h1>
        <p>Set your weekly schedule for tutoring sessions</p>
      </div>

      <div className="availability-actions">
        <button onClick={() => setShowForm(true)} className="action-button">
          + Add Time Slot
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="add-form-card">
          <h3>Add Availability</h3>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Day</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                >
                  {DAYS.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowForm(false)} className="action-button secondary">
                Cancel
              </button>
              <button type="submit" className="action-button" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Slot'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Weekly schedule */}
      <div className="weekly-schedule">
        {DAYS.map(day => (
          <div key={day.value} className="day-column">
            <h3 className="day-header">{day.label}</h3>
            <div className="time-slots">
              {groupedAvailabilities[day.value].length > 0 ? (
                groupedAvailabilities[day.value].map(slot => (
                  <div key={slot.id} className="time-slot">
                    <span className="slot-time">
                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </span>
                    <button 
                      onClick={() => handleDelete(slot.id)}
                      className="delete-slot-btn"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="no-slots">No slots</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Availability;


