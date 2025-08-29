export default function StartPage() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
  
    return (
      <div>
        <h1>Sportplattform</h1>
        {token ? (
          <p>Willkommen, {username}!</p>
        ) : (
          <p>Bitte logge dich ein.</p>
        )}
      </div>
    );
  }
  