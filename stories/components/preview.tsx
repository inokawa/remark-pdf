import React from "react";

export const Preview = ({ data }: { data: string }) => {
  return (
    <iframe
      src={`${data}#toolbar=0`}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
