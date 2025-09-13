import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LogoutPage({ setToken, setIsAdminFlag }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    // Reset state
    setToken(null);
    setIsAdminFlag(false);
    // Redirect to login
    navigate("/login");
  }, [setToken, setIsAdminFlag, navigate]);

  return (
    <div>
      <h2>Logout</h2>
      <p>Du wirst ausgeloggt...</p>
      <button onClick={() => navigate("/login")}>Go to Login</button>
    </div>
  );
}
