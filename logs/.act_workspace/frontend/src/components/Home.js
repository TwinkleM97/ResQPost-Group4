import React from 'react';

const Home = () => {
  const stats = {
    petsFound: 1200,
    activeCities: 70,
    description: "Free & Open for All"
  };

  return (
    <div>
      {/* Hero Section */}
      <section 
        className="hero-section text-white d-flex align-items-center"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("https://images.unsplash.com/photo-1601758228041-f3b2795255f1?ixlib=rb-4.0.3")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: '70vh'
        }}
      >
        <div className="container">
          <div className="row">
            <div className="col-lg-8">
              <div className="missing-label bg-danger text-white px-3 py-1 rounded mb-3 d-inline-block">
                <small className="fw-bold">MISSING</small>
              </div>
              
              <h1 className="display-4 fw-bold mb-4">
                Reuniting Loved Ones,<br />
                One Alert at a Time
              </h1>
              
              <p className="lead mb-4">
                Post and discover missing pet and person alerts in real-time, 
                powered by your community.
              </p>
              
              <div className="d-flex gap-3">
                <a href="/post-alert" className="btn btn-success btn-lg px-4">
                  Submit Alert
                </a>
                <a href="/alerts" className="btn btn-outline-light btn-lg px-4">
                  View Alerts
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-5 bg-light">
        <div className="container">
          <div className="row text-center">
            <div className="col-md-4 mb-4">
              <div className="stat-card">
                <h2 className="display-5 fw-bold text-primary mb-2">
                  {stats.petsFound.toLocaleString()}+
                </h2>
                <p className="text-muted mb-0">pets found</p>
              </div>
            </div>
            
            <div className="col-md-4 mb-4">
              <div className="stat-card">
                <h2 className="display-5 fw-bold text-primary mb-2">
                  Active in<br />{stats.activeCities}+ cities
                </h2>
                <p className="text-muted mb-0">and growing</p>
              </div>
            </div>
            
            <div className="col-md-4 mb-4">
              <div className="stat-card">
                <h2 className="display-5 fw-bold text-primary mb-2">
                  {stats.description}
                </h2>
                <p className="text-muted mb-0">community-powered</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-5">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="display-6 fw-bold mb-3">How ResQPost Works</h2>
            <p className="lead text-muted">
              Simple steps to help reunite families with their loved ones
            </p>
          </div>
          
          <div className="row">
            <div className="col-md-4 mb-4 text-center">
              <div className="feature-icon bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                <i className="bi bi-plus-circle fs-2"></i>
              </div>
              <h4 className="fw-bold mb-3">Submit Alert</h4>
              <p className="text-muted">
                Post details about your missing person or pet with photos and location information.
              </p>
            </div>
            
            <div className="col-md-4 mb-4 text-center">
              <div className="feature-icon bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                <i className="bi bi-people fs-2"></i>
              </div>
              <h4 className="fw-bold mb-3">Community Helps</h4>
              <p className="text-muted">
                Your local community receives notifications and helps look out for your loved one.
              </p>
            </div>
            
            <div className="col-md-4 mb-4 text-center">
              <div className="feature-icon bg-warning text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                <i className="bi bi-heart-fill fs-2"></i>
              </div>
              <h4 className="fw-bold mb-3">Reunion</h4>
              <p className="text-muted">
                Get connected when someone spots your missing family member or pet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-5 bg-primary text-white">
        <div className="container text-center">
          <h2 className="display-6 fw-bold mb-3">Ready to Help?</h2>
          <p className="lead mb-4">
            Join thousands of people helping reunite families every day
          </p>
          <div className="d-flex justify-content-center gap-3">
            <a href="/post-alert" className="btn btn-light btn-lg px-4">
              Report Missing
            </a>
            <a href="/alerts" className="btn btn-outline-light btn-lg px-4">
              Browse Alerts
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;