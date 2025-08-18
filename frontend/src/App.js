import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Components
import Home from './components/Home';
import AlertForm from './components/AlertForm';
import AlertList from './components/AlertList';
import AlertDetail from './components/AlertDetail';
import MapView from './components/MapView';

function App() {
  const [searchTerm, setSearchTerm] = useState('');

  // Navigation Component
  const Navigation = () => {
    return (
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <a className="navbar-brand fw-bold" href="/">
            <span>
              <i className="bi bi-geo-alt-fill me-2"></i> ResQPost
            </span>
          </a>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto">
              <li className="nav-item">
                <a className="nav-link" href="/">Home</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/alerts">Alerts</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/map">Map View</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/about">About</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/contact">Contact</a>
              </li>
            </ul>

            <div className="navbar-nav">
              <a className="btn btn-light me-2" href="/post-alert">
                Report Missing
              </a>
              <div className="nav-item">
                <input
                  className="form-control"
                  type="search"
                  placeholder="Search alerts..."
                  style={{ width: '200px' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  };

  return (
    <Router>
      <div className="App">
        <Navigation />

        <main>
          <Routes>
            <Route path="/" element={<Home searchTerm={searchTerm} />} />
            <Route path="/post-alert" element={<AlertForm />} />
            <Route path="/alerts" element={<AlertList searchTerm={searchTerm} />} />
            <Route path="/alert/:id" element={<AlertDetail />} />
            <Route path="/map" element={<MapView searchTerm={searchTerm} />} />
          </Routes>
        </main>

        <footer className="bg-dark text-light py-4 mt-5">
          <div className="container">
            <div className="row">
              <div className="col-md-6">
                <h5>ResQPost</h5>
                <p className="text-muted">
                  Reuniting loved ones, one alert at a time.
                </p>
              </div>
              <div className="col-md-6 text-md-end">
                <p className="text-muted mb-0">
                  © 2024 ResQPost. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
