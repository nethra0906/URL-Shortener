import React, { useState } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function isLikelyUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function App() {
  const [url, setUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCopied(false);
    setShortUrl("");

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL.");
      return;
    }
    if (!isLikelyUrl(trimmedUrl)) {
      setError("Please enter a valid http:// or https:// URL.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong while shortening the URL.");
        return;
      }
      setShortUrl(data.short_url);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  return (
    <div className="page">
      <div className="sheet">
        <header className="masthead">
          <span className="kicker">Local tool / no signup</span>
          <h1>URL Shortener</h1>
        </header>

        <form onSubmit={handleSubmit} noValidate className="form-row">
          <div className="field">
            <label htmlFor="url-input">Paste a link</label>
            <input
              id="url-input"
              type="text"
              placeholder="https://example.com/a/very/long/path"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "url-error" : undefined}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          <button type="submit" className="run-button" disabled={isLoading}>
            {isLoading ? "working" : "shorten"}
          </button>
        </form>

        {error && (
          <p id="url-error" className="error" role="alert">
            <span aria-hidden="true">＋</span> {error}
          </p>
        )}

        {shortUrl && (
          <div className="result" aria-live="polite">
            <span className="result-label">02 / result</span>
            <div className="result-row">
              <a href={shortUrl} target="_blank" rel="noopener noreferrer">
                {shortUrl}
              </a>
              <button type="button" className="copy-button" onClick={handleCopy}>
                {copied ? "copied" : "copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
