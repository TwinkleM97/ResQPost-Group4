import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';

const parseUTC = (s) => new Date(s?.endsWith('Z') ? s : `${s}Z`);
const getTimeAgo = (dateString) => {
  const now = Date.now();
  const then = parseUTC(dateString).getTime();
  const diffMs = Math.max(0, now - then);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const AlertCard = ({ alert }) => (
  <div className="col-md-6 col-lg-4 mb-4">
    <div className="card alert-card h-100">
      {alert.image_url && (
        <img
          src={alert.image_url}
          className="card-img-top alert-image"
          alt={alert.title}
        />
      )}

      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span className={`badge category-badge ${alert.category === 'pet' ? 'bg-info' : 'bg-warning'}`}>
            {alert.category === 'pet' ? '🐕 Pet' : '👤 Person'}
          </span>
          <small className="text-muted">{getTimeAgo(alert.created_at)}</small>
        </div>

        <h5 className="card-title fw-bold">{alert.title}</h5>
        <p className="card-text text-muted flex-grow-1">
          {alert.description.substring(0, 100)}
          {alert.description.length > 100 ? '...' : ''}
        </p>

        <div className="mt-auto">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-geo-alt-fill text-primary me-1"></i>
            <small className="text-muted">{alert.location}</small>
          </div>

          <a href={`/alert/${alert.id}`} className="btn btn-primary w-100">
            View Details
          </a>
        </div>
      </div>
    </div>
  </div>
);

AlertCard.propTypes = {
  alert: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    image_url: PropTypes.string,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    created_at: PropTypes.string.isRequired,
    is_resolved: PropTypes.bool.isRequired
  }).isRequired
};

const AlertList = ({ searchTerm }) => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    resolved: 'all',
    search: ''
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...alerts];

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(alert => alert.category === filters.category);
    }

    // Filter by resolved status
    if (filters.resolved !== 'all') {
      filtered = filtered.filter(a => a.is_resolved === (filters.resolved === true));
    }

    // Merge navbar searchTerm with local search filter
    const activeSearch = searchTerm || filters.search;
    if (activeSearch) {
      const searchLower = activeSearch.toLowerCase();
      filtered = filtered.filter(alert =>
        alert.title.toLowerCase().includes(searchLower) ||
        alert.description.toLowerCase().includes(searchLower) ||
        alert.location.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAlerts(filtered);
  }, [alerts, filters, searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [alerts, filters, searchTerm, applyFilters]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/alerts');
      if (response.data.success) {
        setAlerts(response.data.alerts);
      } else {
        setError('Failed to load alerts');
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="loading-spinner mx-auto mb-3"></div>
        <p className="text-muted">Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="d-flex filter-pills flex-wrap">
            <button
              className={`filter-pill ${filters.category === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('category', 'all')}
            >
              All
            </button>
            <button
              className={`filter-pill ${filters.category === 'pet' ? 'active' : ''}`}
              onClick={() => handleFilterChange('category', 'pet')}
            >
              🐕 Pets
            </button>
            <button
              className={`filter-pill ${filters.category === 'person' ? 'active' : ''}`}
              onClick={() => handleFilterChange('category', 'person')}
            >
              👤 Persons
            </button>
          </div>
        </div>

        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search alerts..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {/* Alerts Grid */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-search fs-1 text-muted mb-3"></i>
          <h4 className="text-muted mb-3">No alerts found</h4>
          <p className="text-muted mb-4">
            Try adjusting your filters or search terms
          </p>
          <a href="/post-alert" className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i> Post Missing Alert
          </a>
        </div>
      ) : (
        <div className="row">
          {filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
};

AlertList.propTypes = {
  searchTerm: PropTypes.string
};

export default AlertList;
