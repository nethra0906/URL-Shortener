from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
import sqlite3
import string
import random

app = Flask(__name__)
CORS(app)

def get_db():
    conn = sqlite3.connect('urls.db')
    conn.row_factory = sqlite3.Row
    return conn

def generate_short_code(length=6):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def create_table():
    conn = get_db()
    conn.execute('CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, original TEXT, short TEXT UNIQUE)')
    conn.commit()
    conn.close()

@app.route('/shorten', methods=['POST'])
def shorten_url():
    data = request.get_json()
    original_url = data.get('url')
    if not original_url:
        return jsonify({"error": "No URL provided"}), 400

    short_code = generate_short_code()
    conn = get_db()
    conn.execute('INSERT INTO urls (original, short) VALUES (?, ?)', (original_url, short_code))
    conn.commit()
    conn.close()

    short_url = request.host_url + short_code
    return jsonify({"short_url": short_url})

@app.route('/<short_code>')
def redirect_to_original(short_code):
    conn = get_db()
    cur = conn.execute('SELECT original FROM urls WHERE short = ?', (short_code,))
    row = cur.fetchone()
    conn.close()

    if row:
        return redirect(row['original'])
    else:
        return jsonify({"error": "Short URL not found"}), 404

if __name__ == '__main__':
    create_table()  # ✅ call manually before running
    app.run(debug=True)
