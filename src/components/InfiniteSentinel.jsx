import { useEffect, useRef } from "react";

export function InfiniteSentinel({ enabled, onLoad }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoad();
    }, { rootMargin: "240px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onLoad]);
  return <div className="infinite-sentinel" ref={ref} aria-hidden="true" />;
}
