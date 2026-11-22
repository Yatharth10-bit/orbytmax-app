import React from "react";

export function publicPath(path) {
  return typeof path === "string" && path.startsWith("/") ? __SITE_BASE__ + path : path;
}
export default function Link({href, prefetch, children, ...props}) {
  return <a {...props} href={publicPath(href)}>{children}</a>;
}
