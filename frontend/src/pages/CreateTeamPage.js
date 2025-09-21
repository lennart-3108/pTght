import React from 'react';
import TeamForm from '../components/TeamForm';
import { useNavigate } from 'react-router-dom';

export default function CreateTeamPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 16 }}>
      <h2>Create Team</h2>
      <div style={{ maxWidth: 720 }}>
        <TeamForm onCreated={(team) => { if (team && team.id) navigate(`/teams/${team.id}`); else navigate('/teams'); }} />
      </div>
    </div>
  );
}
