import { useEffect, useState } from "react";

const COMPACT_LAYOUT_QUERY = "(max-width: 900px)";

export function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_LAYOUT_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}
