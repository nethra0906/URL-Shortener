import importlib
import os

import pytest


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Fresh app + isolated SQLite DB for every test."""
    db_file = tmp_path / "test_urls.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))

    import app as app_module
    importlib.reload(app_module)  # re-read DATABASE_PATH env var

    app_module.app.testing = True
    with app_module.app.test_client() as client:
        yield client


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}


def test_shorten_returns_short_url(client):
    res = client.post("/shorten", json={"url": "https://example.com/some/long/path"})
    assert res.status_code == 201
    body = res.get_json()
    assert body["original_url"] == "https://example.com/some/long/path"
    assert body["short_url"].endswith(body["short_code"])
    assert len(body["short_code"]) == 6


def test_shorten_rejects_missing_url(client):
    res = client.post("/shorten", json={})
    assert res.status_code == 400
    assert "error" in res.get_json()


def test_shorten_rejects_non_http_scheme(client):
    res = client.post("/shorten", json={"url": "javascript:alert(1)"})
    assert res.status_code == 400


def test_shorten_rejects_url_without_host(client):
    res = client.post("/shorten", json={"url": "https://"})
    assert res.status_code == 400


def test_redirect_follows_short_code(client):
    create_res = client.post("/shorten", json={"url": "https://example.com/target"})
    short_code = create_res.get_json()["short_code"]

    res = client.get(f"/{short_code}", follow_redirects=False)
    assert res.status_code == 302
    assert res.headers["Location"] == "https://example.com/target"


def test_redirect_unknown_code_returns_404(client):
    res = client.get("/does-not-exist")
    assert res.status_code == 404


def test_shorten_generates_distinct_codes_for_same_url(client):
    first = client.post("/shorten", json={"url": "https://example.com"}).get_json()
    second = client.post("/shorten", json={"url": "https://example.com"}).get_json()
    assert first["short_code"] != second["short_code"]
