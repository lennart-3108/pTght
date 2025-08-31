import React, { useEffect, useState } from "react";

export default function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5001/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("Fehler beim Laden des Profils");
        const data = await res.json();
        setUserData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) return <p>Lade Profil...</p>;
  if (!userData) return <p>Keine Profildaten gefunden.</p>;

  return (
    <div>
      <h2>Mein Profil</h2>
      <p>
  <strong>Status:</strong>{" "}
  {userData.is_admin ? (
    <span style={{ color: "green", fontWeight: "bold" }}>✅ Admin</span>
  ) : (
    <span style={{ color: "blue" }}>Normaler User</span>
  )}
</p>

      <p><strong>Vorname:</strong> {userData.firstname}</p>
      <p><strong>Nachname:</strong> {userData.lastname}</p>
      <p><strong>Geburtstag:</strong> {userData.birthday}</p>
      <p><strong>Email:</strong> {userData.email}</p>
      <p><strong>Status:</strong> {userData.is_admin ? "Admin" : "User"}</p>
      <p><strong>Account bestätigt:</strong> {userData.is_confirmed ? "Ja" : "Nein"}</p>
      <p><strong>Sportarten:</strong> {userData.sports.join(", ") || "Keine"}</p>
    </div>
  );
}

