import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import ChatBox from "./Chatbox";
import http, { imgUrl } from "../api";

// Treat backend timestamps as UTC if they don't already include a trailing Z
const parseUTC = (s) => {
  if (!s) return null;
  const dateString = s.endsWith("Z") ? s : `${s}Z`;
  return new Date(dateString);
};

const formatDate = (s) => {
  const d = parseUTC(s);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const AlertDetail = () => {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchAlert = useCallback(async () => {
    try {
      setLoading(true);
      const res = await http.get(`/api/alerts/${id}`);
      if (res.data?.success) {
        setAlert(res.data.alert);
      } else {
        setError("Alert not found");
      }
    } catch (err) {
      console.error("Error fetching alert details:", err);
      setError("Failed to load alert details. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const handleResolveAlert = async () => {
    try {
      setResolving(true);
      const res = await http.patch(`/api/alerts/${id}/resolve`);
      if (res.data?.success) {
        setAlert(res.data.alert);
        setMessage({ type: "success", text: "Alert marked as resolved!" });
      }
    } catch (err) {
      console.error("Error resolving alert:", err);
      setMessage({ type: "error", text: "Failed to resolve alert. Please try again." });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <output className="spinner-border text-primary mb-3">
          <span className="visually-hidden">Loading...</span>
        </output>
        <p className="text-muted">Loading alert details...</p>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <i className="bi bi-exclamation-triangle fs-1 text-warning mb-3"></i>
          <h3 className="mb-3">Alert Not Found</h3>
          <p className="text-muted mb-4">{error || "The requested alert could not be found."}</p>
          <a href="/alerts" className="btn btn-primary">
            Back to Alerts
          </a>
        </div>
      </div>
    );
  }

  const imgSrc = imgUrl(alert.image_url);

  // Build a map link if we have coordinates
  const hasCoords = alert.latitude != null && alert.longitude != null;
  const mapHref = hasCoords
    ? `/map?lat=${encodeURIComponent(alert.latitude)}&lng=${encodeURIComponent(
        alert.longitude
      )}&q=${encodeURIComponent(alert.title)}`
    : null;

  return (
    <div className="container py-5">
      {message.text && (
        <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"} mb-4`}>
          {message.text}
        </div>
      )}

      <div className="row">
        {/* Main Content */}
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <span className={`badge fs-6 mb-2 ${alert.category === "pet" ? "bg-info" : "bg-warning"}`}>
                {alert.category === "pet" ? "🐕 Pet" : "👤 Person"}
              </span>
              {alert.is_resolved && <span className="badge bg-success fs-6 mb-2 ms-2">✅ Found</span>}
            </div>
            <a href="/alerts" className="btn btn-outline-primary">
              ← Back to Alerts
            </a>
          </div>

          <h1 className="h2 mb-3">{alert.title}</h1>

          {imgSrc && (
            <div className="position-relative mb-4">
              {hasCoords ? (
                <a href={mapHref} title="View last location on map" aria-label="View last location on map">
                  <img
                    src={imgSrc}
                    className="img-fluid rounded w-100"
                    alt={alert.title}
                    style={{ maxHeight: "400px", objectFit: "cover", cursor: "pointer" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="position-absolute top-0 end-0 m-2 badge bg-primary" style={{ fontSize: "0.75rem" }}>
                    <i className="bi bi-geo-alt-fill me-1"></i> View on Map
                  </span>
                </a>
              ) : (
                <img
                  src={imgSrc}
                  className="img-fluid rounded w-100"
                  alt={alert.title}
                  style={{ maxHeight: "400px", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
          )}

          <div className="row mb-4">
            <div className="col-md-4">
              <h6 className="fw-bold text-muted">Location</h6>
              <p className="fs-6">
                <i className="bi bi-geo-alt-fill text-primary me-2"></i>
                {alert.location}
              </p>
            </div>

            <div className="col-md-4">
              <h6 className="fw-bold text-muted">Date Reported</h6>
              <p className="fs-6">
                <i className="bi bi-calendar-fill text-primary me-2"></i>
                {formatDate(alert.created_at)}
              </p>
            </div>

            <div className="col-md-4">
              <h6 className="fw-bold text-muted">Status</h6>
              <p className="fs-6">
                <i
                  className={`bi ${
                    alert.is_resolved ? "bi-check-circle-fill text-success" : "bi-clock-fill text-warning"
                  } me-2`}
                ></i>
                {alert.is_resolved ? "Found" : "Still Missing"}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="h4 mb-3">Description</h4>
            <p className="fs-6 lh-base">{alert.description}</p>
          </div>

          {!alert.is_resolved && (
            <div className="mb-4">
              <button
                className="btn btn-success btn-lg px-4 py-2 fw-semibold"
                onClick={handleResolveAlert}
                disabled={resolving}
              >
                {resolving ? (
                  <>
                    <output>
                      <span className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">Loading...</span>
                      </span>
                    </output>
                    <span>Marking as Found...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    <span>Mark as Found</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Chat Component */}
          <ChatBox alertId={id} />
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          {(alert.contact_name || alert.contact_phone || alert.contact_email) && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title fw-bold mb-3">
                  <i className="bi bi-person-fill me-2"></i> Contact Information
                </h5>

                {alert.contact_name && (
                  <div className="mb-2">
                    <strong>Name:</strong>
                    <br />
                    {alert.contact_name}
                  </div>
                )}

                {alert.contact_phone && (
                  <div className="mb-2">
                    <strong>Phone:</strong>
                    <br />
                    <a href={`tel:${alert.contact_phone}`} className="text-decoration-none btn btn-outline-primary btn-sm">
                      <i className="bi bi-telephone-fill me-1"></i>
                      {alert.contact_phone}
                    </a>
                  </div>
                )}

                {alert.contact_email && (
                  <div className="mb-2">
                    <strong>Email:</strong>
                    <br />
                    <a
                      href={`mailto:${alert.contact_email}`}
                      className="text-decoration-none btn btn-outline-primary btn-sm"
                    >
                      <i className="bi bi-envelope-fill me-1"></i>
                      {alert.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title fw-bold">Share This Alert</h5>
              <p className="card-text text-muted mb-3">Help spread the word by sharing this alert on social media</p>

              <div className="d-grid gap-2">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${window.location.href}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <i className="bi bi-facebook me-2"></i> Share on Facebook
                </a>

                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(alert.title)}&url=${
                    window.location.href
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-info"
                >
                  <i className="bi bi-twitter me-2"></i> Share on Twitter
                </a>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setMessage({ type: "success", text: "Link copied to clipboard!" });
                  }}
                >
                  <i className="bi bi-link me-2"></i> Copy Link
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-light">
            <div className="card-body">
              <h6 className="fw-bold mb-2">
                <i className="bi bi-shield-check me-2 text-warning"></i> Safety Reminder
              </h6>
              <p className="small text-muted mb-0">
                If you have information about this case, please use the chat below or contact the person directly. Do
                not approach if you feel unsafe — contact local authorities instead.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetail;
