"""URL Shortener API.

A small Flask service that stores (original_url -> short_code) pairs in
SQLite and redirects visitors from the short code to the original URL.
"""
import os
import secrets
import sqlite3
import string
from contextlib import contextmanager
from urllib.parse import urlparse

from flask import Flask, g, jsonify, redirect, request
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "urls.db"))

# Allowed URL schemes. Rejecting everything else blocks `javascript:`,
# `data:`, `file:` etc. from being stored and later served back as an
# open redirect.
ALLOWED_SCHEMES = {"http", "https"}

# Codes that could otherwise collide with real API routes.
RESERVED_CODES = {"shorten", "health", "favicon.ico"}

SHORT_CODE_LENGTH = 6
SHORT_CODE_ALPHABET = string.ascii_letters + string.digits
MAX_SHORT_CODE_ATTEMPTS = 10


def create_app():
    app = Flask(__name__)

    # In production, set ALLOWED_ORIGINS to a comma-separated list of
    # trusted frontend origins instead of allowing every origin.
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    origins = "*" if allowed_origins == "*" else [o.strip() for o in allowed_origins.split(",")]
    CORS(app, resources={r"/*": {"origins": origins}})

    init_db()

    @app.teardown_appcontext
    def close_db(_exception=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})

    @app.route("/shorten", methods=["POST"])
    def shorten_url():
        payload = request.get_json(silent=True) or {}
        original_url = (payload.get("url") or "").strip()

        if not original_url:
            return jsonify({"error": "No URL provided"}), 400

        error = validate_url(original_url)
        if error:
            return jsonify({"error": error}), 400

        db = get_db()
        short_code = insert_with_unique_code(db, original_url)
        if short_code is None:
            return jsonify({"error": "Could not generate a unique short code, please try again"}), 500

        short_url = request.host_url + short_code
        return jsonify({"short_url": short_url, "short_code": short_code, "original_url": original_url}), 201

    @app.route("/<short_code>")
    def redirect_to_original(short_code):
        db = get_db()
        row = db.execute(
            "SELECT original FROM urls WHERE short = ?", (short_code,)
        ).fetchone()

        if row is None:
            return jsonify({"error": "Short URL not found"}), 404

        return redirect(row["original"])

    return app


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@contextmanager
def _standalone_connection():
    """A DB connection for use outside a Flask request/app context."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with _standalone_connection() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original TEXT NOT NULL,
                short TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.commit()


def validate_url(url):
    """Return an error message if `url` is unsafe/invalid, else None."""
    if len(url) > 2048:
        return "URL is too long"

    try:
        parsed = urlparse(url)
    except ValueError:
        return "Malformed URL"

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return "URL must start with http:// or https://"
    if not parsed.netloc:
        return "URL is missing a host"

    return None


def generate_short_code(length=SHORT_CODE_LENGTH):
    # secrets.choice is a CSPRNG; random.choices is not suitable for
    # anything an attacker could try to predict or enumerate.
    return "".join(secrets.choice(SHORT_CODE_ALPHABET) for _ in range(length))


def insert_with_unique_code(db, original_url):
    """Insert `original_url` under a fresh short code, retrying on collision."""
    for _ in range(MAX_SHORT_CODE_ATTEMPTS):
        short_code = generate_short_code()
        if short_code in RESERVED_CODES:
            continue
        try:
            db.execute(
                "INSERT INTO urls (original, short) VALUES (?, ?)",
                (original_url, short_code),
            )
            db.commit()
            return short_code
        except sqlite3.IntegrityError:
            continue  # short code collision, try again
    return None


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode, port=int(os.environ.get("PORT", 5000)))
