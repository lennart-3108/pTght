import React from "react";
import { Link } from "react-router-dom";

const Header = () => {
  const mainColor = "rgb(11, 43, 33)";  // Hauptfarbe
  const contrastColor = "rgb(128, 54, 13)";  // Kontrastfarbe

  return (
    <header style={{
      backgroundColor: mainColor,
      color: contrastColor,
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      position: "fixed",
      top: 0,
      width: "100%",
      zIndex: 1000
    }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img 
          src="/images/matchleague_logo.png" 
          alt="MatchLeague Logo" 
          style={{ height: "40px", marginRight: "10px" }} 
        />
        <span style={{ fontSize: "24px", fontWeight: "bold", color: contrastColor }}>MatchLeague</span>
      </Link>
      {/* Weitere Header-Elemente können hier hinzugefügt werden, z.B. Navigation */}
    </header>
  );
};

export default Header;
