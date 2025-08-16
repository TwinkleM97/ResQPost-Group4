import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// ---- Leaflet default marker fix ------------------------------------------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ---- Category icons ------------------------------------------------------------
const petIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiMxN2EyYjgiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfkJU8L3RleHQ+Cjwvc3ZnPg==',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25],
});

const personIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTEiIGZpbGw9IiNmZmMxMDciLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iYmxhY2siIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfkKQ8L3RleHQ+Cjwvc3ZnPg==',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25],
});

// Optional: a distinct icon for "focused" location from URL
const focusIcon = new L.Icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [0, -46],
});

// ---- Helpers -------------------------------------------------------------------
const parseUTC = (s) => new Date(s?.endsWith('Z') ? s : `${s}Z`);
const timeAgo = (dateString) => {
  const now = Date.now();
  const then = parseUTC(dateString).getTime();
  const diff = Math.max(0, now - then);
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (d > 0) return `${d} day${d > 1 ? 's' : ''} ago`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''} ago`;
  return 'Just now';
};

async function geocode(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      q
    )}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ResQPost/1.0 (demo)',
        Referer: window.location.origin,
      },
    }
  );
  const data = await res.json();
  if (Array.isArray(data) && data.length) {
    const { lat, lon, display_name } = data[0];
    return {
      lat: Number(lat),
      lon: Number(lon),
      displayName: display_name,
    };
  }
  return null;
}

// Smooth fly helper
const FlyTo = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
};

// ---- Component -----------------------------------------------------------------
const MapView = () => {
  const [alerts, setAlerts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({ category: 'all', search: '' });

  // Map state
  const [center, setCenter] = useState([41.8781, -87.6298]); // default Chicago
  const [zoom, setZoom] = useState(11);
  const mapRef = useRef(null);

  // Focus marker from URL (?lat/lon or ?q)
  const [params] = useSearchParams();
  const [focusMarker, setFocusMarker] = useState(null); // {lat, lon, label}

  // Try to use geolocation for initial center
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {} // keep default if denied
    );
  }, []);

  // Fetch alerts
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/alerts');
        if (res.data?.success) {
          // Only unresolved with coordinates for pins
          const withCoords = res.data.alerts.filter(
            (a) => a.latitude && a.longitude && !a.is_resolved
          );
          setAlerts(withCoords);
        } else {
          setError('Failed to load alerts');
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load alerts. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Apply filters
  useEffect(() => {
    let out = [...alerts];
    if (filters.category !== 'all') {
      out = out.filter((a) => a.category === filters.category);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      out = out.filter(
        (a) =>
          a.title.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s) ||
          a.location.toLowerCase().includes(s)
      );
    }
    setFiltered(out);
  }, [alerts, filters]);

  // Deep-link handling: ?lat & ?lon or ?q
  useEffect(() => {
    const lat = params.get('lat');
    const lon = params.get('lon');
    const q = params.get('q');
    const label = params.get('label') || 'Reported location';

    (async () => {
      if (lat && lon && isFinite(Number(lat)) && isFinite(Number(lon))) {
        const la = Number(lat);
        const lo = Number(lon);
        setCenter([la, lo]);
        setZoom(15);
        setFocusMarker({ lat: la, lon: lo, label });
        return;
      }
      if (q) {
        try {
          const hit = await geocode(q);
          if (hit) {
            setCenter([hit.lat, hit.lon]);
            setZoom(15);
            setFocusMarker({ lat: hit.lat, lon: hit.lon, label });
          } else {
            console.warn('No geocode result for:', q);
          }
        } catch (e) {
          console.error('Geocode error', e);
        }
      }
    })();
  }, [params]);

  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const mapProps = useMemo(
    () => ({
      center,
      zoom,
      whenCreated: (m) => (mapRef.current = m),
      scrollWheelZoom: true,
    }),
    [center, zoom]
  );

  // Loading
  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="loading-spinner mx-auto mb-3" />
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
            <h2 className="fw-bold mb-2">Missing Alerts</h2>
            <p className="text-muted">
              Click a list item or a map pin to view more details.
            </p>
          </div>

          {error && <div className="alert alert-danger mb-4">{error}</div>}

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Filters</h5>

              <div className="mb-3">
                <label htmlFor="category" className="form-label">
                  Category
                </label>
                <select
                  id="category"
                  className="form-select"
                  value={filters.category}
                  onChange={(e) => setFilter('category', e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="pet">Pets only</option>
                  <option value="person">Persons only</option>
                </select>
              </div>

              <div className="mb-3">
                <label htmlFor="search" className="form-label">
                  Search
                </label>
                <input
                  id="search"
                  type="text"
                  className="form-control"
                  placeholder="Search by name, location, etc."
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                />
              </div>

              <div className="small text-muted">
                Showing {filtered.length} of {alerts.length} alerts
              </div>
            </div>
          </div>

          {/* Alert list */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-search fs-1 text-muted mb-3" />
                <p className="text-muted">No alerts found</p>
              </div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`card mb-3 text-start ${
                    selectedAlert?.id === a.id ? 'border-primary' : ''
                  }`}
                  style={{ border: 'none', background: 'transparent' }}
                  onClick={() => {
                    setSelectedAlert(a);
                    setCenter([a.latitude, a.longitude]);
                    setZoom(15);
                  }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span
                        className={`badge ${
                          a.category === 'pet' ? 'bg-info' : 'bg-warning'
                        }`}
                      >
                        {a.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                      </span>
                      <small className="text-muted">{timeAgo(a.created_at)}</small>
                    </div>
                    <h6 className="card-title mb-1">{a.title}</h6>
                    <p className="small text-muted mb-2">
                      {a.description.slice(0, 90)}
                      {a.description.length > 90 ? '…' : ''}
                    </p>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-geo-alt-fill text-primary me-1" />
                      <small className="text-muted">{a.location}</small>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="col-lg-8">
          <div className="map-container" style={{ height: 520 }}>
            <MapContainer {...mapProps} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Deep-link / focus marker */}
              {focusMarker && (
                <Marker
                  position={[focusMarker.lat, focusMarker.lon]}
                  icon={focusIcon}
                >
                  <Popup>
                    <strong>{focusMarker.label}</strong>
                    {params.get('q') && (
                      <div className="small text-muted mt-1">{params.get('q')}</div>
                    )}
                  </Popup>
                </Marker>
              )}

              {/* Alert markers */}
              {filtered.map((a) => (
                <Marker
                  key={a.id}
                  position={[a.latitude, a.longitude]}
                  icon={a.category === 'pet' ? petIcon : personIcon}
                  eventHandlers={{
                    click: () => {
                      setSelectedAlert(a);
                      setCenter([a.latitude, a.longitude]);
                      setZoom(15);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span
                          className={`badge ${
                            a.category === 'pet' ? 'bg-info' : 'bg-warning'
                          }`}
                        >
                          {a.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                        </span>
                        <small className="text-muted">{timeAgo(a.created_at)}</small>
                      </div>
                      <h6 className="fw-bold mb-2">{a.title}</h6>
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="img-fluid rounded mb-2"
                          style={{ maxHeight: 120, width: '100%', objectFit: 'cover' }}
                        />
                      )}
                      <p className="small text-muted mb-2">
                        {a.description.slice(0, 100)}
                        {a.description.length > 100 ? '…' : ''}
                      </p>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-geo-alt-fill text-primary me-1" />
                        <small>{a.location}</small>
                      </div>
                      <div className="d-grid">
                        <a
                          href={`/alert/${a.id}`}
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

              <FlyTo center={center} zoom={zoom} />
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mt-3">
            <div className="card">
              <div className="card-body d-flex align-items-center gap-4 flex-wrap">
                <h6 className="card-title mb-0">Map Legend</h6>
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle me-2"
                    style={{ width: 20, height: 20, backgroundColor: '#17a2b8' }}
                  />
                  <small>🐕 Missing Pets</small>
                </div>
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle me-2"
                    style={{ width: 20, height: 20, backgroundColor: '#ffc107' }}
                  />
                  <small>👤 Missing Persons</small>
                </div>
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-circle me-2"
                    style={{ width: 20, height: 20, backgroundColor: '#3b82f6' }}
                  />
                  <small>Focus (from link)</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected alert modal */}
      {selectedAlert && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{selectedAlert.title}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedAlert(null)}
                  />
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
                        <span
                          className={`badge ${
                            selectedAlert.category === 'pet' ? 'bg-info' : 'bg-warning'
                          } mb-2`}
                        >
                          {selectedAlert.category === 'pet' ? '🐕 Pet' : '👤 Person'}
                        </span>
                        <h6 className="text-muted">Description</h6>
                        <p>{selectedAlert.description}</p>
                      </div>

                      <div className="mb-3">
                        <h6 className="text-muted">Location</h6>
                        <p className="mb-1">
                          <i className="bi bi-geo-alt-fill text-primary me-2" />
                          {selectedAlert.location}
                        </p>
                        <a
                          className="btn btn-outline-primary btn-sm"
                          href={`/map?lat=${selectedAlert.latitude}&lon=${selectedAlert.longitude}&label=${encodeURIComponent(
                            selectedAlert.title
                          )}`}
                        >
                          Open on Map
                        </a>
                      </div>

                      <div className="mb-3">
                        <h6 className="text-muted">Date Reported</h6>
                        <p className="mb-0">{timeAgo(selectedAlert.created_at)}</p>
                      </div>

                      {selectedAlert.contact_phone && (
                        <div className="mb-3">
                          <h6 className="text-muted">Contact</h6>
                          <a
                            href={`tel:${selectedAlert.contact_phone}`}
                            className="btn btn-outline-primary btn-sm"
                          >
                            <i className="bi bi-telephone me-1" />
                            {selectedAlert.contact_phone}
                          </a>
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
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
};

export default MapView;
