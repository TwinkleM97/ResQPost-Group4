import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different categories
const petIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiMxN2EyYjgiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfkJU8L3RleHQ+Cjwvc3ZnPg==',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

const personIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiNmZmMxMDciLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iYmxhY2siIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfkKQ8L3RleHQ+Cjwvc3ZnPg==',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

const MapView = () => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [filters, setFilters] = useState({
    category: 'all',
    search: ''
  });
  const [userLocation, setUserLocation] = useState([41.8781, -87.6298]); // Default to Chicago

  useEffect(() => {
    fetchAlerts();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [alerts, filters]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log('Error getting location:', error);
          // Keep default location
        }
      );
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/alerts');
      
      if (response.data.success) {
        // Filter alerts that have coordinates
        const alertsWithCoords = response.data.alerts.filter(
          alert => alert.latitude && alert.longitude && !alert.is_resolved
        );
        setAlerts(alertsWithCoords);
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

  const applyFilters = () => {
    let filtered = [...alerts];

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(alert => alert.category === filters.category);
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(alert =>
        alert.title.toLowerCase().includes(searchLower) ||
        alert.description.toLowerCase().includes(searchLower) ||
        alert.location.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAlerts(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const alertDate = new Date(dateString);
    const diffTime = Math.abs(now - alertDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Today';
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="loading-spinner mx-auto mb-3"></div>
        <p className="text-muted">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row">
        {/* Sidebar */}
        <div className="col-lg-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-3">Missing Alerts</h2>
            <p className="text-muted">
              Click on an alert entry or map pin to view more details.
            </p>
          </div>

          {error && (
            <div className="alert alert-danger mb-4">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Filters</h5>
              
              <div className="mb-3">
                <label className="form-label" htmlFor="category-select">Category</label>
                <select
                  id="category-select"
                  className="form-select"
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="pet">Pets Only</option>
                  <option value="person">Persons Only</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label" htmlFor="search-input">Search</label>
                <input
                  id="search-input"
                  type="text"
                  className="form-control"
                  placeholder="Search by name, location..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
              
              <div className="text-muted small">
                Showing {filteredAlerts.length} of {alerts.length} alerts
              </div>
            </div>
          </div>

          {/* Alert List */}
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-search fs-1 text-muted mb-3"></i>
                <p className="text-muted">No alerts found</p>
              </div>
            ) : (
              filteredAlerts.map(alert => (
                <button
                  key={alert.id}
                  type="button"
                  className={`card mb-3 cursor-pointer text-start ${selectedAlert?.id === alert.id ? 'border-primary' : ''}`}
                  onClick={() => setSelectedAlert(alert)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0 }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className={`badge ${alert.category === 'pet' ? 'bg-info' : 'bg-warning'}`}>
                        {alert.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                      </span>
                      <small className="text-muted">{getTimeAgo(alert.created_at)}</small>
                    </div>
                    
                    <h6 className="card-title mb-2">{alert.title}</h6>
                    <p className="card-text small text-muted mb-2">
                      {alert.description.substring(0, 80)}
                      {alert.description.length > 80 ? '...' : ''}
                    </p>
                    
                    <div className="d-flex align-items-center">
                      <i className="bi bi-geo-alt-fill text-primary me-1"></i>
                      <small className="text-muted">{alert.location}</small>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="col-lg-8">
          <div className="map-container">
            <MapContainer
              center={userLocation}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredAlerts.map(alert => (
                <Marker
                  key={alert.id}
                  position={[alert.latitude, alert.longitude]}
                  icon={alert.category === 'pet' ? petIcon : personIcon}
                  eventHandlers={{
                    click: () => setSelectedAlert(alert)
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className={`badge ${alert.category === 'pet' ? 'bg-info' : 'bg-warning'}`}>
                          {alert.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                        </span>
                        <small className="text-muted">{getTimeAgo(alert.created_at)}</small>
                      </div>
                      
                      <h6 className="fw-bold mb-2">{alert.title}</h6>
                      
                      {alert.image_url && (
                        <img 
                          src={alert.image_url} 
                          alt={alert.title}
                          className="img-fluid rounded mb-2"
                          style={{ maxHeight: '120px', width: '100%', objectFit: 'cover' }}
                        />
                      )}
                      
                      <p className="small text-muted mb-2">
                        {alert.description.substring(0, 100)}
                        {alert.description.length > 100 ? '...' : ''}
                      </p>
                      
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-geo-alt-fill text-primary me-1"></i>
                        <small>{alert.location}</small>
                      </div>
                      
                      <div className="d-grid">
                        <a 
                          href={`/alert/${alert.id}`} 
                          className="btn btn-primary btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Full Details
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mt-3">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Map Legend</h6>
                <div className="d-flex gap-4">
                  <div className="d-flex align-items-center">
                    <div 
                      className="rounded-circle me-2" 
                      style={{ width: '20px', height: '20px', backgroundColor: '#17a2b8' }}
                    ></div>
                    <small>🐕 Missing Pets</small>
                  </div>
                  <div className="d-flex align-items-center">
                    <div 
                      className="rounded-circle me-2" 
                      style={{ width: '20px', height: '20px', backgroundColor: '#ffc107' }}
                    ></div>
                    <small>👤 Missing Persons</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Alert Details Modal */}
      {selectedAlert && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedAlert.title}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setSelectedAlert(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    {selectedAlert.image_url && (
                      <img 
                        src={selectedAlert.image_url} 
                        alt={selectedAlert.title}
                        className="img-fluid rounded mb-3"
                      />
                    )}
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <span className={`badge ${selectedAlert.category === 'pet' ? 'bg-info' : 'bg-warning'} mb-2`}>
                        {selectedAlert.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                      </span>
                      <h6 className="text-muted">Description</h6>
                      <p>{selectedAlert.description}</p>
                    </div>
                    
                    <div className="mb-3">
                      <h6 className="text-muted">Location</h6>
                      <p>
                        <i className="bi bi-geo-alt-fill text-primary me-2"></i>
                        {selectedAlert.location}
                      </p>
                    </div>
                    
                    <div className="mb-3">
                      <h6 className="text-muted">Date Reported</h6>
                      <p>{getTimeAgo(selectedAlert.created_at)}</p>
                    </div>
                    
                    {selectedAlert.contact_phone && (
                      <div className="mb-3">
                        <h6 className="text-muted">Contact</h6>
                        <p>
                          <a href={`tel:${selectedAlert.contact_phone}`} className="btn btn-outline-primary btn-sm">
                            <i className="bi bi-telephone me-1"></i>
                            {selectedAlert.contact_phone}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedAlert(null)}
                >
                  Close
                </button>
                <a 
                  href={`/alert/${selectedAlert.id}`} 
                  className="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Full Details
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {selectedAlert && <div className="modal-backdrop fade show"></div>}
    </div>
  );
};

export default MapView;