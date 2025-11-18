export function handleInvalidToken(err, navigate) {
  const msg = String(err || "");
  if (msg.toLowerCase().includes("invalid token")) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("token");
        // Set a one-time flag/message for the login page
        localStorage.setItem("authNotice", "Du wurdest automatisch ausgeloggt.");
      }
    } catch (e) {
      // ignore storage errors
    }
    if (navigate) {
      navigate("/login");
    }
    return true;
  }
  return false;
}
