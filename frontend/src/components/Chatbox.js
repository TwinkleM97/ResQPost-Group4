import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

const ChatBox = ({ alertId }) => {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [sender, setSender] = useState('');
  const [text, setText] = useState('');
  const [showLocationShare, setShowLocationShare] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const listRef = useRef(null);

  const fetchMessages = React.useCallback(async () => {
    try {
      const res = await axios.get(`/api/alerts/${alertId}/messages`);
      if (res.data?.success) {
        setMessages(res.data.messages);
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 5000); // light polling
    return () => clearInterval(id);
  }, [alertId, fetchMessages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode to get address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                'User-Agent': 'ResQPost/1.0',
              },
            }
          );
          const data = await response.json();
          
          setLocationData({
            latitude,
            longitude,
            address: data.display_name || `${latitude}, ${longitude}`,
          });
          setShowLocationShare(true);
        } catch (error) {
          console.error('Error getting address:', error);
          setLocationData({
            latitude,
            longitude,
            address: `${latitude}, ${longitude}`,
          });
          setShowLocationShare(true);
        }
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please try again or enter it manually.');
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  const sendWithLocation = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    let messageText = text.trim();
    
    // If location is being shared, append it to the message
    if (showLocationShare && locationData) {
      messageText += `\n\n📍 Current Location: ${locationData.address}\nCoordinates: ${locationData.latitude}, ${locationData.longitude}`;
    }

    try {
      await axios.post(`/api/alerts/${alertId}/messages`, {
        sender_name: sender || undefined,
        text: messageText,
      });
      setText('');
      setShowLocationShare(false);
      setLocationData(null);
      fetchMessages(); // refresh after sending
    } catch (e) {
      console.error('Error sending message:', e);
      alert('Failed to send message. Please try again.');
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    try {
      await axios.post(`/api/alerts/${alertId}/messages`, {
        sender_name: sender || undefined,
        text: text.trim(),
      });
      setText('');
      fetchMessages(); // refresh after sending
    } catch (e) {
      console.error('Error sending message:', e);
      alert('Failed to send message. Please try again.');
    }
  };

  const formatMessageText = (text) => {
    // Split by lines and render location info specially
    const lines = text.split('\n');
    // Generate a unique key for each line using a hash of the line and its index
    const getLineKey = (line, index) =>
      `${line}-${index}-${line.length}-${
        typeof line === 'string' ? line.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0
      }`;
    return lines.map((line, index) => {
      const key = getLineKey(line, index);
      if (line.startsWith('📍 Current Location:')) {
        return (
          <div key={key} className="mt-2 p-2 bg-light rounded">
            <small className="text-success fw-bold">
              <i className="bi bi-geo-alt-fill me-1"></i>{" "}
              Shared Location
            </small>
            <div className="small">{line.replace('📍 Current Location: ', '')}</div>
          </div>
        );
      }
      if (line.startsWith('Coordinates:')) {
        const coords = line.replace('Coordinates: ', '').split(', ');
        if (coords.length === 2) {
          const [lat, lng] = coords;
          return (
            <div key={key} className="small">
              <a
                href={`/map?lat=${lat}&lng=${lng}&label=Reported Location`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none"
              >
                <i className="bi bi-map me-1"></i>{" "}
                View on Map
              </a>
            </div>
          );
        }
        return <div key={key} className="small text-muted">{line}</div>;
      }
      return line ? <div key={key}>{line}</div> : <br key={key} />;
    });
  };

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-chat-dots me-2"></i>{" "}
          Chat & Sightings
        </h6>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div className="card-body">
          {loading ? (
            <div className="text-center py-3">
              <output>
                <div className="spinner-border spinner-border-sm text-primary me-2">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </output>
              <span className="text-muted">Loading messages...</span>
            </div>
          ) : (
            <>
              {/* Messages Display */}
              <div
                ref={listRef}
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  background: '#f8f9fa',
                }}
              >
                {messages.length === 0 ? (
                  <div className="text-center py-3">
                    <i className="bi bi-chat-square-dots fs-4 text-muted mb-2"></i>
                    <div className="text-muted small">
                      No messages yet. Share tips, sightings, or updates here.
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="mb-3 p-2 bg-white rounded border">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong className="text-primary">
                          {m.sender_name || 'Anonymous'}
                        </strong>
                        <span className="text-muted small">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-break">
                        {formatMessageText(m.text)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="mb-3">
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      setText("🎉 Great news! I found them and they're safe!");
                      setSender('');
                    }}
                  >
                    <i className="bi bi-check-circle me-1"></i>{" "}
                    Found Safe
                  </button>
                  <button
                    type="button"
                    className="btn btn-info btn-sm"
                    onClick={() => {
                      setText("👀 I think I saw them at ");
                      setSender('');
                    }}
                  >
                    <i className="bi bi-eye me-1"></i>{' '}
                    Sighting
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? (
                      <output className="d-flex align-items-center">
                        <span className="spinner-border spinner-border-sm me-1"></span>{' '}
                        Getting Location...
                      </output>
                    ) : (
                      <>
                        <i className="bi bi-geo-alt me-1"></i>{' '}
                        Share Location
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Location Sharing Preview */}
              {showLocationShare && locationData && (
                <div className="alert alert-info mb-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>
                        <i className="bi bi-geo-alt-fill me-1"></i>{" "}
                        Location will be shared:
                      </strong>
                      <div className="small mt-1">{locationData.address}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      onClick={() => {
                        setShowLocationShare(false);
                        setLocationData(null);
                      }}
                    ></button>
                  </div>
                </div>
              )}

              {/* Message Form */}
              <form onSubmit={showLocationShare ? sendWithLocation : send}>
                <div className="mb-2">
                  <input
                    className="form-control"
                    placeholder="Your name (optional)"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <textarea
                    className="form-control"
                    placeholder="Share a tip, sighting, or update..."
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                  />
                </div>
                <div className="d-flex gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-primary flex-grow-1"
                    disabled={!text.trim()}
                  >
                    <i className="bi bi-send me-1"></i>{' '}
                    Send Message
                  </button>
                  {!showLocationShare && (
                    <button
                      type="button"
                      className="btn btn-outline-warning"
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      title="Share your current location with this message"
                    >
                      <i className="bi bi-geo-alt"></i>
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-2">
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>{' '}
                  Messages are public and help coordinate search efforts.
                </small>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
ChatBox.propTypes = {
  alertId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default ChatBox;

