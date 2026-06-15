import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "legacy/**",
    "orbital-app/**",
    "index.html",
    "script.js",
    "server.js",
    "styles.css",
    "js/**",
    "data/**",
    "mobile/.expo/**",
    "mobile/dist*/**",
    "mobile/scripts/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
