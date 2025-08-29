import React from "react";
import { useNavigate } from "react-router-dom";

export default function LogoutPage({ setToken, setIsAdminFlag }) {
  const navigate = useNavigate();

  const doLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("is_admin");
    setToken(null);
    setIsAdminFlag(false);
    navigate("/login");
  };

  return (
    <div style={{ margin: 40 }}>
      <h2>Logout</h2>
      <button onClick={doLogout}>Jetzt ausloggen</button>
    </div>
  );
}
