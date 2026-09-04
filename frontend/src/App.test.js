import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function typeUrl(value) {
  fireEvent.change(screen.getByLabelText(/paste a link/i), {
    target: { value },
  });
}

test("renders the heading and form", () => {
  render(<App />);
  expect(screen.getByText(/URL Shortener/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /shorten/i })).toBeInTheDocument();
});

test("shows a validation error for an empty submission", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /shorten/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/enter a url/i);
});

test("shows a validation error for a non-http URL", () => {
  render(<App />);
  typeUrl("javascript:alert(1)");
  fireEvent.click(screen.getByRole("button", { name: /shorten/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/valid http/i);
});

test("displays the shortened URL returned by the API", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ short_url: "http://localhost:5000/abc123" }),
  });

  render(<App />);
  typeUrl("https://example.com");
  fireEvent.click(screen.getByRole("button", { name: /shorten/i }));

  await waitFor(() =>
    expect(screen.getByText("http://localhost:5000/abc123")).toBeInTheDocument()
  );
});

test("shows a server error message when the API call fails", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "No URL provided" }),
  });

  render(<App />);
  typeUrl("https://example.com");
  fireEvent.click(screen.getByRole("button", { name: /shorten/i }));

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/no url provided/i)
  );
});

test("shows a network error message when fetch throws", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

  render(<App />);
  typeUrl("https://example.com");
  fireEvent.click(screen.getByRole("button", { name: /shorten/i }));

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/could not reach the server/i)
  );
});
