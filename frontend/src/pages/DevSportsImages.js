import React from "react";

// Simple gallery to preview images in src/images/sports
function importAll(r) {
  try {
    return r.keys().map((k) => ({ key: k.replace(/^\.\//, ""), src: r(k) }));
  } catch {
    return [];
  }
}

const images = importAll(require.context("../images/sports", false, /\.(png|jpe?g|webp|svg)$/));

export default function DevSportsImages() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Sports Images Browser</h2>
      {images.length === 0 ? (
        <div style={{ color: "#c66" }}>Keine Bilder gefunden in src/images/sports.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            alignItems: "start",
          }}
        >
          {images.map((img) => (
            <figure key={img.key} style={{ margin: 0, background: "#0b1e19", padding: 8, borderRadius: 10, border: "1px solid #1a3c33" }}>
              <img
                src={img.src}
                alt={img.key}
                style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, display: "block" }}
              />
              <figcaption style={{ fontSize: 12, color: "#9db", marginTop: 6 }}>{img.key}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, color: "#9db" }}>
        <div>Quelle: <code>src/images/sports</code></div>
        <div>Diese Galerie ist nur für Entwicklungsvorschau.</div>
      </div>
    </div>
  );
}
