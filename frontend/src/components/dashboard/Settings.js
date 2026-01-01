import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyProfile, updateMyProfile, updateMyProfileWithImage, getChoices } from '../../services/api';
import './Settings.css';

function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [choices, setChoices] = useState({ subjects: [], grades: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const isTutor = user?.role === 'TUTOR';

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, choicesRes] = await Promise.all([
          getMyProfile(),
          getChoices(),
        ]);

        if (profileRes.success) {
          setProfile(profileRes.data);
        }
        if (choicesRes.success) {
          setChoices(choicesRes.data);
        }
      } catch (err) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultiSelect = (field, value) => {
    const current = profile[field] || [];
    if (current.includes(value)) {
      handleChange(field, current.filter(v => v !== value));
    } else {
      handleChange(field, [...current, value]);
    }
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setProfileImageFile(file);
      setError('');

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileImageUpload = async () => {
    if (!profileImageFile) return;

    setError('');
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('profile_image', profileImageFile);

      const response = await updateMyProfileWithImage(formData);

      if (response.success) {
        setProfile(prev => ({
          ...prev,
          profile_image_url: response.data.profile_image_url
        }));
        setProfileImageFile(null);
        setProfileImagePreview(null);
        setSuccess('Profile picture updated successfully!');
        setTimeout(() => setSuccess(''), 3000);

        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveProfileImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const dataToSend = isTutor
        ? {
            bio: profile.bio,
            hourly_rate: profile.hourly_rate,
            subjects: profile.subjects,
            grades_taught: profile.grades_taught,
            qualifications: profile.qualifications,
            is_available_for_instant: profile.is_available_for_instant,
          }
        : {
            current_grade: profile.current_grade,
            subjects_needed: profile.subjects_needed,
            learning_goals: profile.learning_goals,
          };

      const response = await updateMyProfile(dataToSend);

      if (response.success) {
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your profile and preferences</p>
      </div>

      {/* Profile Picture Section */}
      <div className="settings-card profile-picture-card">
        <h2>Profile Picture</h2>
        <div className="profile-picture-section">
          <div className="current-profile-picture">
            {(profileImagePreview || profile?.profile_image_url) ? (
              <img
                src={profileImagePreview || profile.profile_image_url}
                alt="Profile preview"
                className="profile-image-preview"
              />
            ) : (
              <div className="profile-picture-placeholder">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
          </div>

          <div className="profile-picture-controls">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Image
            </button>

            {profileImageFile && (
              <>
                <button
                  type="button"
                  className="action-button"
                  onClick={handleProfileImageUpload}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  className="secondary-button cancel"
                  onClick={handleRemoveProfileImage}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          <div className="profile-picture-info">
            <p>Upload a profile picture to help others recognize you.</p>
            <p className="file-requirements">Supported formats: JPG, PNG. Max size: 5MB.</p>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h2>Profile Information</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* User info (read-only) */}
          <div className="form-section">
            <h3>Account</h3>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email || ''} disabled />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input type="text" value={user?.first_name || ''} disabled />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input type="text" value={user?.last_name || ''} disabled />
              </div>
            </div>
          </div>

          {isTutor ? (
            // Tutor settings
            <>
              <div className="form-section">
                <h3>Tutor Profile</h3>
                <div className="form-group">
                  <label>About You</label>
                  <textarea
                    value={profile?.bio || ''}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                <div className="form-group">
                  <label>Qualifications</label>
                  <textarea
                    value={profile?.qualifications || ''}
                    onChange={(e) => handleChange('qualifications', e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div className="form-group">
                  <label>Hourly Rate (£)</label>
                  <input
                    type="number"
                    value={profile?.hourly_rate || 25}
                    onChange={(e) => handleChange('hourly_rate', parseFloat(e.target.value))}
                    min="5"
                    max="200"
                    step="0.50"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Subjects You Teach</h3>
                <div className="multi-select-grid">
                  {choices.subjects.map(subject => (
                    <button
                      key={subject.key}
                      type="button"
                      className={`select-chip ${(profile?.subjects || []).includes(subject.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('subjects', subject.key)}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>Grade Levels</h3>
                <div className="multi-select-grid">
                  {choices.grades.map(grade => (
                    <button
                      key={grade.key}
                      type="button"
                      className={`select-chip ${(profile?.grades_taught || []).includes(grade.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('grades_taught', grade.key)}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>Instant Tutoring</h3>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={profile?.is_available_for_instant || false}
                    onChange={(e) => handleChange('is_available_for_instant', e.target.checked)}
                  />
                  <span>Available for instant tutoring requests</span>
                </label>
              </div>
            </>
          ) : (
            // Student settings
            <>
              <div className="form-section">
                <h3>Student Profile</h3>
                <div className="form-group">
                  <label>Current Grade Level</label>
                  <select
                    value={profile?.current_grade || ''}
                    onChange={(e) => handleChange('current_grade', e.target.value)}
                  >
                    <option value="">Select your grade...</option>
                    {choices.grades.map(grade => (
                      <option key={grade.key} value={grade.key}>{grade.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Learning Goals</label>
                  <textarea
                    value={profile?.learning_goals || ''}
                    onChange={(e) => handleChange('learning_goals', e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="What do you want to achieve?"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Subjects You Need Help With</h3>
                <div className="multi-select-grid">
                  {choices.subjects.map(subject => (
                    <button
                      key={subject.key}
                      type="button"
                      className={`select-chip ${(profile?.subjects_needed || []).includes(subject.key) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('subjects_needed', subject.key)}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="action-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;

