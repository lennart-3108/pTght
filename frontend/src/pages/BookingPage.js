import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// BookingPage (legacy) now redirects to the dedicated Slot Search flow at /slots
export default function BookingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/slots', { replace: true });
  }, [navigate]);
  return null;
}
