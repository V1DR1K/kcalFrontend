import { useCallback, useEffect, useState } from "react";

export function useTrainingData(load, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await load());
    } catch (requestError) {
      setError(requestError?.message || "No pudimos cargar los datos de entrenamiento.");
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
