import React, { useState } from "react";
import http from "../api";

const AlertForm = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "pet",
    location: "",
    latitude: "",
    longitude: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // capture lat/lon AND fill Location with a human-readable address
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: "error", text: "Geolocation is not supported by this browser." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setFormData((prev) => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lon.toString(),
        }));

        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18&accept-language=en`,
            { headers: { Accept: "application/json" } }
          );

          let locationText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

          if (resp.ok) {
            const data = await resp.json();
            const a = data?.address || {};
            const road = [a.house_number, a.road].filter(Boolean).join(" ");
            const locality = a.city || a.town || a.village || a.municipality || a.hamlet;
            const state = a.state || a.province || a.region;
            const country = a.country;
            const pieces = [road, locality, state, country].filter(Boolean);
            locationText = pieces.length ? pieces.join(", ") : data.display_name || locationText;
          }

          setFormData((prev) => ({ ...prev, location: locationText }));
          setMessage({ type: "success", text: "Location captured successfully!" });
        } catch {
          setFormData((prev) => ({ ...prev, location: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }));
          setMessage({ type: "success", text: "Location captured successfully!" });
        }
      },
      (error) => {
        const msg =
          error.code === error.PERMISSION_DENIED
            ? "Location access is blocked. Allow it in the site permissions (padlock icon) or enter it manually."
            : "Unable to get location. Please enter it manually.";
        setMessage({ type: "error", text: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const submitData = new FormData();

      // Add all form fields
      Object.keys(formData).forEach((key) => {
        if (formData[key]) submitData.append(key, formData[key]);
      });

      // Add image if selected
      if (selectedImage) {
        submitData.append("image", selectedImage);
      }

      const response = await http.post(`/api/alerts`, submitData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setMessage({ type: "success", text: "Alert submitted successfully!" });

        // Reset form
        setFormData({
          title: "",
          description: "",
          category: "pet",
          location: "",
          latitude: "",
          longitude: "",
          contact_name: "",
          contact_phone: "",
          contact_email: "",
        });
        setSelectedImage(null);
        setImagePreview(null);

        // Redirect after 2 seconds
        setTimeout(() => {
          window.location.href = "/alerts";
        }, 2000);
      }
    } catch (error) {
      let msg = 'Failed to submit alert. Please try again.';
      if (error.response) {
        const dataMsg = typeof error.response.data === 'string'
          ? error.response.data
          : (error.response.data?.error || '');
        msg = `Server error ${error.response.status}${dataMsg ? `: ${dataMsg}` : ''}`;
      } else if (error.message) {
        msg = error.message;
      }
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="form-container">
        <div className="text-center mb-5">
          <h1 className="display-6 fw-bold mb-3">Create a Missing Alert</h1>
          <p className="lead text-muted">Help us spread the word about your missing loved one</p>
        </div>

        {message.text && (
          <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"} mb-4`}>
            {message.text}
          </div>
        )}

        <div className="card shadow">
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              {/* Category Selection */}
              <div className="mb-4">
                <fieldset className="btn-group w-100" style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="visually-hidden">Category</legend>
                  <input
                    type="radio"
                    className="btn-check"
                    name="category"
                    id="person"
                    value="person"
                    checked={formData.category === "person"}
                    onChange={handleInputChange}
                  />
                  <label className="btn btn-outline-primary" htmlFor="person">
                    Person
                  </label>

                  <input
                    type="radio"
                    className="btn-check"
                    name="category"
                    id="pet"
                    value="pet"
                    checked={formData.category === "pet"}
                    onChange={handleInputChange}
                  />
                  <label className="btn btn-outline-primary" htmlFor="pet">
                    Pet
                  </label>
                </fieldset>
              </div>

              {/* Title */}
              <div className="mb-3">
                <label htmlFor="title" className="form-label fw-bold">
                  Title *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder={formData.category === "pet" ? "e.g., Lost Dog - Molly" : "e.g., Missing Person - John Doe"}
                  required
                />
              </div>

              {/* Description */}
              <div className="mb-3">
                <label htmlFor="description" className="form-label fw-bold">
                  Description *
                </label>
                <textarea
                  className="form-control"
                  id="description"
                  name="description"
                  rows="4"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide a description of the missing person or pet"
                  required
                />
              </div>

              {/* Location */}
              <div className="mb-3">
                <label htmlFor="location" className="form-label fw-bold">
                  Location *
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., Lakeside Park, Springfield"
                    required
                  />
                  <button type="button" className="btn btn-outline-secondary" onClick={getCurrentLocation}>
                    📍 Use Current Location
                  </button>
                </div>
              </div>

              {/* Coordinates (Hidden/Optional) */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <input type="hidden" name="latitude" value={formData.latitude} onChange={handleInputChange} />
                </div>
                <div className="col-md-6">
                  <input type="hidden" name="longitude" value={formData.longitude} onChange={handleInputChange} />
                </div>
              </div>

              {/* Image Upload */}
              <div className="mb-4">
                <label htmlFor="imageUpload" className="form-label fw-bold">
                  Upload Image
                </label>
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="imageUpload" className="cursor-pointer">
                    {imagePreview ? (
                      <div>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="img-fluid mb-3"
                          style={{ maxHeight: "200px" }}
                        />
                        <p className="text-muted mb-0">Click to change image</p>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-cloud-upload fs-1 text-muted mb-3"></i>
                        <p className="text-muted mb-0">Click to upload image or drag and drop</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-4">
                <h5 className="fw-bold mb-3">Contact Information</h5>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="contact_name" className="form-label">
                      Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="contact_name"
                      name="contact_name"
                      value={formData.contact_name}
                      onChange={handleInputChange}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="contact_phone" className="form-label">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      id="contact_phone"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleInputChange}
                      placeholder="+1234567890"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="contact_email" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="contact_email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="d-grid">
                <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="loading-spinner me-2"></span>
                      <span>Submitting Alert...</span>
                    </>
                  ) : (
                    "Submit Alert"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertForm;
