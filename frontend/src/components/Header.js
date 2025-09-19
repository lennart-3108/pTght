import React from "react";
import { Link } from "react-router-dom";
import matchLeagueLogo from "../images/matchleague_logo.png";

export default function Header() {
  const mainColor = "rgb(11, 43, 33)";
  const contrastColor = "rgb(255,255,255)";

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
        <img src={matchLeagueLogo} alt="MatchLeague Logo" style={{ height: "36px", marginRight: "10px" }} />
        <span style={{ fontSize: "20px", fontWeight: "bold", color: contrastColor }}>MatchLeague</span>
      </Link>
    </header>
  );
}
