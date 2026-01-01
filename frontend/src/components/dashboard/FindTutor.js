import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchTutors, getChoices } from '../../services/api';
import { HiStar, HiSearch } from 'react-icons/hi';
import './FindTutor.css';

function FindTutor() {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState({ subjects: [], grades: [] });
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    min_price: '',
    max_price: '',
    instant_available: false,
    search: '',
    sort: '-average_rating',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    getChoices().then(res => {
      if (res.success) {
        setChoices(res.data);
      }
    });
  }, []);

  useEffect(() => {
    async function loadTutors() {
      setLoading(true);
      try {
        const params = {
          ...filters,
          page,
          instant_available: filters.instant_available ? 'true' : '',
        };
        const response = await searchTutors(params);
        if (response.success) {
          setTutors(response.data.results || []);
          setTotalPages(Math.ceil((response.data.count || 0) / 12));
        }
      } catch (error) {
        console.error('Error loading tutors:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTutors();
  }, [filters, page]);

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      subject: '',
      grade: '',
      min_price: '',
      max_price: '',
      instant_available: false,
      search: '',
      sort: '-average_rating',
    });
    setPage(1);
  };

  return (
    <div className="find-tutor-page">
      <div className="page-header">
        <h1>Find a Tutor</h1>
        <p>Search and filter tutors to find the perfect match</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search by name..."
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <select name="subject" value={filters.subject} onChange={handleFilterChange}>
              <option value="">All Subjects</option>
              {choices.subjects.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select name="grade" value={filters.grade} onChange={handleFilterChange}>
              <option value="">All Grades</option>
              {choices.grades.map(g => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group price-range">
            <input
              type="number"
              name="min_price"
              value={filters.min_price}
              onChange={handleFilterChange}
              placeholder="Min £"
              min="0"
            />
            <span>-</span>
            <input
              type="number"
              name="max_price"
              value={filters.max_price}
              onChange={handleFilterChange}
              placeholder="Max £"
              min="0"
            />
          </div>

          <div className="filter-group">
            <select name="sort" value={filters.sort} onChange={handleFilterChange}>
              <option value="-average_rating">Highest Rated</option>
              <option value="hourly_rate">Price: Low to High</option>
              <option value="-hourly_rate">Price: High to Low</option>
              <option value="-total_sessions">Most Sessions</option>
            </select>
          </div>

          <label className="filter-checkbox">
            <input
              type="checkbox"
              name="instant_available"
              checked={filters.instant_available}
              onChange={handleFilterChange}
            />
            <span>Available Now</span>
          </label>

          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tutors...</p>
        </div>
      ) : tutors.length > 0 ? (
        <>
          <div className="tutors-grid">
            {tutors.map(tutor => (
              <div key={tutor.id} className="tutor-card">
                <Link to={`/student/tutor/${tutor.id}`} className="tutor-card-link">
                  <div className="tutor-card-header">
                    <div className="tutor-avatar-large">
                      {tutor.profile_image_url ? (
                        <img src={tutor.profile_image_url} alt={tutor.user.full_name} />
                      ) : (
                        <span>{tutor.user.first_name?.[0]}{tutor.user.last_name?.[0]}</span>
                      )}
                    </div>
                    {tutor.is_available_for_instant && (
                      <span className="available-now-badge">Available Now</span>
                    )}
                  </div>

                  <div className="tutor-card-body">
                    <h3>{tutor.user.full_name}</h3>
                    
                    <div className="tutor-rating">
                      {parseFloat(tutor.average_rating) > 0 ? (
                        <>
                          <span className="stars">
                            {Array.from({ length: Math.round(parseFloat(tutor.average_rating)) }, (_, i) => (
                              <HiStar key={i} />
                            ))}
                          </span>
                          <span className="rating-value">{parseFloat(tutor.average_rating).toFixed(1)}</span>
                          <span className="review-count">({tutor.total_reviews} reviews)</span>
                        </>
                      ) : (
                        <span className="no-reviews">New Tutor</span>
                      )}
                    </div>

                    <div className="tutor-subjects">
                      {tutor.subjects_display?.slice(0, 3).map(s => (
                        <span key={s.key} className="subject-tag">{s.label}</span>
                      ))}
                      {tutor.subjects_display?.length > 3 && (
                        <span className="subject-tag more">+{tutor.subjects_display.length - 3}</span>
                      )}
                    </div>

                    <p className="tutor-bio">{tutor.bio?.substring(0, 100)}...</p>
                  </div>

                  <div className="tutor-card-footer">
                    <span className="tutor-price">£{tutor.hourly_rate}/hr</span>
                    <span className="tutor-sessions">{tutor.total_sessions} sessions</span>
                  </div>
                </Link>

                <div className="tutor-card-actions">
                  <Link to={`/student/tutor/${tutor.id}`} className="action-button secondary">
                    View Profile
                  </Link>
                  <Link to={`/student/tutor/${tutor.id}/book`} className="action-button">
                    Book Session
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><HiSearch /></div>
          <h3>No tutors found</h3>
          <p>Try adjusting your filters or search criteria</p>
          <button onClick={clearFilters} className="action-button">
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default FindTutor;

