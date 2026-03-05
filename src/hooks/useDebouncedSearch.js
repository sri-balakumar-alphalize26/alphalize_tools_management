import { useState, useCallback, useRef } from "react";

const useDebouncedSearch = (onSearch, delay = 500) => {
  const [searchText, setSearchText] = useState("");
  const timerRef = useRef(null);

  const handleSearch = useCallback(
    (text) => {
      setSearchText(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(text);
      }, delay);
    },
    [onSearch, delay]
  );

  const clearSearch = useCallback(() => {
    setSearchText("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearch("");
  }, [onSearch]);

  return { searchText, handleSearch, clearSearch };
};

export default useDebouncedSearch;
