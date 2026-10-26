import Link from "next/link";

// Fallback for requests that never reach a locale segment.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#FBF8F3",
          color: "#1E2A44",
          fontFamily: "Georgia, serif",
          textAlign: "center",
        }}
      >
        <main>
          <h1>Page not found</h1>
          <p>
            <Link href="/en" style={{ color: "#1E2A44" }}>
              Go to the home page
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
