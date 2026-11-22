import React from "react";
import { publicPath } from "./link";
export default function Image({src, priority, fill, unoptimized, ...props}) {
  return <img {...props} src={publicPath(src)} loading={priority ? "eager" : props.loading} />;
}
