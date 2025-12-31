import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, getChoices } from '../services/api';
import './ProfileCompletion.css';

function ProfileCompletion() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState({ subjects: [], grades: [] });
  
  // Form data
  const [formData, setFormData] = useState({
    bio: '',
    hourly_rate: 25,
    subjects: [],
    grades_taught: [],
    qualifications: '',
    current_grade: '',
    subjects_needed: [],
    learning_goals: '',
    is_available_for_instant: false,
  });

  const isTutor = user?.role === 'TUTOR';

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, choicesRes] = await Promise.all([
          getMyProfile(),
          getChoices(),
        ]);

        if (choicesRes.success) {
          setChoices(choicesRes.data);
        }

        if (profileRes.success) {
          const profile = profileRes.data;
          setFormData(prev => ({
            ...prev,
            bio: profile.bio || '',
            hourly_rate: profile.hourly_rate || 25,
            subjects: profile.subjects || [],
            grades_taught: profile.grades_taught || [],
            qualifications: profile.qualifications || '',
            current_grade: profile.current_grade || '',
            subjects_needed: profile.subjects_needed || [],
            learning_goals: profile.learning_goals || '',
            is_available_for_instant: profile.is_available_for_instant || false,
          }));

          // If profile is already complete, redirect
          if (profile.is_profile_complete) {
            const redirectPath = isTutor ? '/tutor' : '/student';
            navigate(redirectPath, { replace: true });
          }
        }
      } catch (err) {
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isTutor, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleMultiSelect = (field, value) => {
    setFormData(prev => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (isTutor) {
      if (!formData.bio.trim()) {
        setError('Please enter a bio');
        return;
      }
      if (formData.subjects.length === 0) {
        setError('Please select at least one subject');
        return;
      }
      if (formData.grades_taught.length === 0) {
        setError('Please select at least one grade level');
        return;
      }
    } else {
      if (!formData.current_grade) {
        setError('Please select your current grade');
        return;
      }
      if (formData.subjects_needed.length === 0) {
        setError('Please select at least one subject');
        return;
      }
    }

    setSaving(true);
    try {
      const dataToSend = isTutor
        ? {
            bio: formData.bio,
            hourly_rate: formData.hourly_rate,
            subjects: formData.subjects,
            grades_taught: formData.grades_taught,
            qualifications: formData.qualifications,
            is_available_for_instant: formData.is_available_for_instant,
          }
        : {
            current_grade: formData.current_grade,
            subjects_needed: formData.subjects_needed,
            learning_goals: formData.learning_goals,
          };

      const response = await updateMyProfile(dataToSend);
      
      if (response.success) {
        updateUser({ is_profile_complete: true });
        const redirectPath = isTutor ? '/tutor' : '/student';
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-completion-container">
        <div className="profile-completion-card">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-completion-container">
      <div className="profile-completion-card">
        <h1>Complete Your Profile</h1>
        <p className="subtitle">
          {isTutor 
            ? 'Tell students about yourself and your tutoring services'
            : 'Help us match you with the right tutors'
          }
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          {isTutor ? (
            // Tutor form
            <>
              <div className="form-group">
                <label htmlFor="bio">About You *</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell students about your teaching experience, style, and what makes you a great tutor..."
                  rows={4}
                  maxLength={1000}
                />
                <span className="char-count">{formData.bio.length}/1000</span>
              </div>

              <div className="form-group">
                <label>Subjects You Teach *</label>
                <div className="multi-select-grid">
                  {choices.subjects.map(subject => (
                    <button
                      key={subject.key}
                      type="button"
                      className={`select-chip ${formData.subjects.includes(subject.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('subjects', subject.key)}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Grade Levels You Teach *</label>
                <div className="multi-select-grid">
                  {choices.grades.map(grade => (
                    <button
                      key={grade.key}
                      type="button"
                      className={`select-chip ${formData.grades_taught.includes(grade.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('grades_taught', grade.key)}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="hourly_rate">Hourly Rate (£)</label>
                  <input
                    type="number"
                    id="hourly_rate"
                    name="hourly_rate"
                    value={formData.hourly_rate}
                    onChange={handleChange}
                    min="5"
                    max="200"
                    step="0.50"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="qualifications">Qualifications</label>
                <textarea
                  id="qualifications"
                  name="qualifications"
                  value={formData.qualifications}
                  onChange={handleChange}
                  placeholder="Your degrees, certifications, or relevant experience..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_available_for_instant"
                    checked={formData.is_available_for_instant}
                    onChange={handleChange}
                  />
                  <span>Available for instant tutoring requests</span>
                </label>
                <p className="help-text">Students can request immediate help when you're available</p>
              </div>
            </>
          ) : (
            // Student form
            <>
              <div className="form-group">
                <label htmlFor="current_grade">Your Current Grade Level *</label>
                <select
                  id="current_grade"
                  name="current_grade"
                  value={formData.current_grade}
                  onChange={handleChange}
                >
                  <option value="">Select your grade...</option>
                  {choices.grades.map(grade => (
                    <option key={grade.key} value={grade.key}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subjects You Need Help With *</label>
                <div className="multi-select-grid">
                  {choices.subjects.map(subject => (
                    <button
                      key={subject.key}
                      type="button"
                      className={`select-chip ${formData.subjects_needed.includes(subject.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('subjects_needed', subject.key)}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="learning_goals">Learning Goals (Optional)</label>
                <textarea
                  id="learning_goals"
                  name="learning_goals"
                  value={formData.learning_goals}
                  onChange={handleChange}
                  placeholder="What do you want to achieve? Any specific topics or exams you're preparing for?"
                  rows={3}
                  maxLength={500}
                />
              </div>
            </>
          )}

          <button type="submit" className="submit-button" disabled={saving}>
            {saving ? 'Saving...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileCompletion;

