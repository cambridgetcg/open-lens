const missing = [];

if (process.env.CAPTIONEER_PRODUCTION_GATES_ACKNOWLEDGED !== "yes") {
  missing.push("CAPTIONEER_PRODUCTION_GATES_ACKNOWLEDGED=yes");
}
if (!process.env.CAPTIONEER_ABUSE_CONTROL?.trim()) {
  missing.push("CAPTIONEER_ABUSE_CONTROL=<deployed key/rate/quota control>");
}

const retentionPolicy = process.env.CAPTIONEER_PROVIDER_RETENTION_POLICY_URL;
try {
  if (!retentionPolicy || new URL(retentionPolicy).protocol !== "https:") throw new Error();
} catch {
  missing.push("CAPTIONEER_PROVIDER_RETENTION_POLICY_URL=https://...");
}

if (missing.length) {
  console.error("Production deploy blocked. Complete docs/DEPLOYMENT.md and set:\n  " + missing.join("\n  "));
  process.exit(1);
}

console.log("Production gate acknowledgement present. Verify the same abuse-control and retention metadata are configured in the Cloudflare deployment.");
