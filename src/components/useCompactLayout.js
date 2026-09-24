import { useEffect, useState } from "react";

// The desktop sidebar leaves too little room for a readable two-column
// collection workspace until the viewport exceeds 1200px.
const COMPACT_LAYOUT_QUERY = "(max-width: 1200px)";

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
