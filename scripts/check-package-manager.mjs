if (!process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  console.error("Use pnpm 10.33.2 to preserve the workspace lockfile.");
  process.exitCode = 1;
}
