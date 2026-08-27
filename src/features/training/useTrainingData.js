import { useCallback, useEffect, useRef, useState } from "react";

export function useTrainingData(load, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const reload = useCallback(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError("");
    try {
      const nextData = await load();
      if (sequence === requestSequence.current) setData(nextData);
    } catch (requestError) {
      if (sequence === requestSequence.current) setError(requestError?.message || "No pudimos cargar los datos de entrenamiento.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, dependencies);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
