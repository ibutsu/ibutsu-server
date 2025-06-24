import { useEffect, useState, useRef } from 'react';

/**
 * Hook to dynamically measure SVG container dimensions
 * @returns {Object} { containerRef, width, height }
 */
export const useSVGContainerDimensions = () => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 60 });
  const resizeObserverRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setDimensions({
            width: rect.width || 300,
            height: Math.max(60, rect.height || 60),
          });
        }, 50);
      }
    };

    // Initial measurement
    if (containerRef.current) {
      updateDimensions();
    }

    // Set up ResizeObserver
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(updateDimensions);
      resizeObserverRef.current.observe(containerRef.current);
    }

    // Fallback for window resize
    window.addEventListener('resize', updateDimensions);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  return { containerRef, width: dimensions.width, height: dimensions.height };
};
