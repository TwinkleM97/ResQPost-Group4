// frontend/src/components/AlertList.js
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import http, { imgUrl } from "../api";

// Treat backend timestamps as UTC if they don't already include a trailing Z
const parseUTC = (s) => (!s ? new Date(0) : new Date(s.endsWith("Z") ? s : `${s}Z`));

const getTimeAgo = (dateString) => {
  const now = Date.now();
  const then = parseUTC(dateString).getTime();
  const diffMs = Math.max(0, now - then);
  const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  if (d > 0) return `${d} day${d > 1 ? "s" : ""} ago`;
  if (h > 0) return `${h} hour${h > 1 ? "s" : ""} ago`;
  return "Just now";
};

const AlertCard = ({ alert }) => (
  <div className="col-md-6 col-lg-4 mb-4">
    <div className="card alert-card h-100 position-relative">
      {alert.is_resolved && (
        <span
          className="badge bg-success position-absolute"
          style={{ top: 10, right: 10 }}
          title="Resolved"
        >
          Resolved
        </span>
      )}

      {alert.image_url && (
        <img
          src={imgUrl(alert.image_url)}
          className="card-img-top alert-image"
          alt={alert.title}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}

      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span
            className={`badge category-badge ${
              alert.category === "pet" ? "bg-info" : "bg-warning"
            }`}
          >
            {alert.category === "pet" ? "🐕 Pet" : "👤 Person"}
          </span>
          <small className="text-muted">{getTimeAgo(alert.created_at)}</small>
        </div>

        <h5 className="card-title fw-bold">{alert.title}</h5>
        <p className="card-text text-muted flex-grow-1">
          {alert.description.substring(0, 100)}
          {alert.description.length > 100 ? "..." : ""}
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
    is_resolved: PropTypes.bool.isRequired,
  }).isRequired,
};

const AlertList = ({ searchTerm }) => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default to **open** so resolved do NOT show on homepage
  const [filters, setFilters] = useState({
    category: "all",   // "all" | "pet" | "person"
    resolved: "open",  // "open" | "resolved" | "all"
    search: "",
  });

  useEffect(() => {
    fetchAlerts(filters.resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAlerts = async (resolvedMode = "open") => {
    try {
      setLoading(true);

      // Ask backend for only what we need when possible:
      // open -> resolved=false, resolved -> resolved=true, all -> no param
      let url = "/api/alerts";
      if (resolvedMode === "open") url = "/api/alerts?resolved=false";
      else if (resolvedMode === "resolved") url = "/api/alerts?resolved=true";

      const response = await http.get(url);
      if (response.data?.success) {
        setAlerts(response.data.alerts || []);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let out = [...alerts];

    // Category filter
    if (filters.category !== "all") {
      out = out.filter((a) => a.category === filters.category);
    }

    // Resolved filter (client-side guard; backend already tried to reduce)
    if (filters.resolved === "open") {
      out = out.filter((a) => !a.is_resolved);
    } else if (filters.resolved === "resolved") {
      out = out.filter((a) => a.is_resolved);
    }

    // Search (merge navbar searchTerm with local search)
    const activeSearch = (searchTerm || filters.search || "").toLowerCase();
    if (activeSearch) {
      out = out.filter((a) => {
        const t = `${a.title} ${a.description} ${a.location}`.toLowerCase();
        return t.includes(activeSearch);
      });
    }

    setFilteredAlerts(out);
  }, [alerts, filters, searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [alerts, filters, searchTerm, applyFilters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // If resolved mode changes, refetch with server-side filter for efficiency
      if (key === "resolved") fetchAlerts(value);
      return next;
    });
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
      <div className="row mb-4 gy-3 align-items-center">
        <div className="col-lg-6">
          <div className="d-flex filter-pills flex-wrap gap-2">
            <button
              className={`filter-pill ${filters.category === "all" ? "active" : ""}`}
              onClick={() => handleFilterChange("category", "all")}
            >
              All
            </button>
            <button
              className={`filter-pill ${filters.category === "pet" ? "active" : ""}`}
              onClick={() => handleFilterChange("category", "pet")}
            >
              🐕 Pets
            </button>
            <button
              className={`filter-pill ${filters.category === "person" ? "active" : ""}`}
              onClick={() => handleFilterChange("category", "person")}
            >
              👤 Persons
            </button>
          </div>
        </div>

        <div className="col-lg-3">
          <div className="btn-group w-100" role="group" aria-label="Resolved filter">
            <button
              className={`btn btn-outline-secondary ${filters.resolved === "open" ? "active" : ""}`}
              onClick={() => handleFilterChange("resolved", "open")}
              title="Show only unresolved alerts"
            >
              Open
            </button>
            <button
              className={`btn btn-outline-secondary ${filters.resolved === "resolved" ? "active" : ""}`}
              onClick={() => handleFilterChange("resolved", "resolved")}
              title="Show only resolved alerts"
            >
              Resolved
            </button>
            <button
              className={`btn btn-outline-secondary ${filters.resolved === "all" ? "active" : ""}`}
              onClick={() => handleFilterChange("resolved", "all")}
              title="Show all alerts"
            >
              All
            </button>
          </div>
        </div>

        <div className="col-lg-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search alerts..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />
        </div>
      </div>

      {/* Alerts Grid */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-search fs-1 text-muted mb-3"></i>
          <h4 className="text-muted mb-3">No alerts found</h4>
          <p className="text-muted mb-4">Try adjusting your filters or search terms</p>
          <a href="/post-alert" className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i> Post Missing Alert
          </a>
        </div>
      ) : (
        <div className="row">
          {filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
};

AlertList.propTypes = {
  searchTerm: PropTypes.string,
};

export default AlertList;
