import React from "react";
import { Link } from "react-router-dom";
import matchLeagueLogo from "../images/matchleague_logo_long.png"; // use long branded logo

export default function Header() {
  return (
    <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/">
      <img src={matchLeagueLogo} alt="MatchLeague" style={{ height: "30px", width: "auto" }} />
    </Link>
  );
}
