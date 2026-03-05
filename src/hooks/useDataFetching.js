import { useState, useCallback } from "react";

const LIMIT = 20;

const useDataFetching = (fetchFunction) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(
    async (search = "") => {
      try {
        setLoading(true);
        setOffset(0);
        const result = await fetchFunction({ offset: 0, limit: LIMIT, search });
        setData(result || []);
        setHasMore((result || []).length >= LIMIT);
      } catch (error) {
        console.error("Fetch error:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchFunction]
  );

  const fetchMoreData = useCallback(async () => {
    if (!hasMore || loading) return;
    try {
      const newOffset = offset + LIMIT;
      const result = await fetchFunction({ offset: newOffset, limit: LIMIT });
      setData((prev) => [...prev, ...(result || [])]);
      setOffset(newOffset);
      setHasMore((result || []).length >= LIMIT);
    } catch (error) {
      console.error("Fetch more error:", error);
    }
  }, [fetchFunction, offset, hasMore, loading]);

  return { data, loading, fetchData, fetchMoreData, hasMore, setData };
};

export default useDataFetching;
