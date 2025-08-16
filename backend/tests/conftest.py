# backend/tests/conftest.py
import os
import pytest

# Use an in-memory DB for fast, isolated tests
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import app as flask_app, db  # uses DATABASE_URL above

@pytest.fixture(scope="function")
def app():
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=os.environ["DATABASE_URL"],
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    # Create tables once per test
    with flask_app.app_context():
        db.create_all()
    yield flask_app
    # Drop tables after each test
    with flask_app.app_context():
        db.drop_all()

# Automatically push an app context for every test so db.session works
@pytest.fixture(scope="function", autouse=True)
def _app_ctx(app):
    ctx = app.app_context()
    ctx.push()
    try:
        yield
    finally:
        ctx.pop()

@pytest.fixture()
def client(app):
    return app.test_client()
