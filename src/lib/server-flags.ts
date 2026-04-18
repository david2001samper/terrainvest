export function isDevLikeEnvironment() {
  return process.env.NODE_ENV !== "production";
}

export function isSeedRouteEnabled() {
  return process.env.ENABLE_ADMIN_SEED_ROUTE === "true" && isDevLikeEnvironment();
}

export function isDebugRouteEnabled() {
  return process.env.ENABLE_DEBUG_API === "true" && isDevLikeEnvironment();
}
