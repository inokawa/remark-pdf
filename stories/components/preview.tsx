import React, { useEffect, useMemo, useRef } from "react";

export const Preview = ({ data }: { data: Blob }) => {
  const url = useMemo(() => URL.createObjectURL(data), [data]);

  const prev = useRef(url);
  useEffect(() => {
    const prevUrl = prev.current;
    if (prevUrl !== url) {
      URL.revokeObjectURL(prevUrl);
    }

    prev.current = url;
  }, [url]);

  return <iframe src={`${url}#toolbar=0`} style={{ flex: 1 }} />;
};
