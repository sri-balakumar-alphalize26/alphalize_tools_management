import { useState } from "react";

const useLoader = (initialValue = false) => {
  const [loader, setLoader] = useState(initialValue);

  const startLoading = () => setLoader(true);
  const stopLoading = () => setLoader(false);

  return [loader, startLoading, stopLoading];
};

export default useLoader;
