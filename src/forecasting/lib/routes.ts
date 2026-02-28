const DEFAULT_FORECAST_BASE_PATH = "/forecast";

const normalizeBasePath = (value?: string): string => {
  if (!value) {
    return DEFAULT_FORECAST_BASE_PATH;
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  return withoutTrailingSlash === "/" ? "" : withoutTrailingSlash;
};

export const FORECAST_BASE_PATH = normalizeBasePath(import.meta.env.VITE_FORECAST_BASE_PATH);

export const forecastRoute = (path = ""): string => {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  if (!FORECAST_BASE_PATH) {
    return normalizedPath || "/";
  }

  return `${FORECAST_BASE_PATH}${normalizedPath}`;
};
