import { useState, useEffect } from 'react';

// Custom hook für responsive design
export function useResponsive(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialwert basierend auf aktueller Bildschirmbreite
    return typeof window !== 'undefined' ? window.innerWidth < breakpoint : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Event Listener hinzufügen
    window.addEventListener('resize', handleResize);
    
    // Initial check (falls sich während der ersten Render-Zyklen etwas ändert)
    handleResize();

    // Cleanup: Event Listener entfernen
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

// Alternative: Mehrere Breakpoints
export function useBreakpoints() {
  const [breakpoints, setBreakpoints] = useState(() => {
    if (typeof window === 'undefined') {
      return { isMobile: false, isTablet: false, isDesktop: true };
    }
    
    const width = window.innerWidth;
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setBreakpoints({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoints;
}