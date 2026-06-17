/**
 * @param {any} p loose: project params object, shape defined elsewhere
 * @param {any} xtVersion loose: version object
 * @param {any} manifestVersion loose: numeric manifest version
 */
export default function generateManifestJson(p, xtVersion, manifestVersion) {
  /** @type {any} */
  const manifest = {
    "name": p.meta.name,
    "version": xtVersion.version,
    "manifest_version": manifestVersion,
    "description": p.description,
    "icons": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    },
    "content_scripts": [{
      "js": ["script.js"],
      "matches": p.meta.matches_only.concat(p.meta.matches, p.meta.matches_extra),
      "exclude_matches": p.meta.exclude_matches,
      "all_frames": true,
      "run_at": "document_start"
    }],
    "background": { },
    "homepage_url": p.meta.page,
    "minimum_chrome_version": p.meta.min.chrome,
    "applications": {
      "gecko": {
        "id": p.meta.appidGecko,
      }
    },
  };

  if (manifestVersion === 3) {
    manifest.background.service_worker = "eventPage.js";

    manifest.permissions = ["storage", "scripting", "webRequest"];
    manifest.host_permissions = p.meta.matches_only.concat(p.meta.matches);
    manifest.optional_host_permissions = ["*://*/"];
  } else {
    manifest.background.scripts = ["eventPage.js"],
    manifest.background.persistent = false;

    manifest.permissions = p.meta.matches_only.concat(p.meta.matches, ["storage"]);
    manifest.optional_permissions = ["*://*/"];
  }

  // manifest.update_url = `${p.meta.downloads}updates${channel}.xml`;
  // manifest.applications.gecko.update_url = `${p.meta.downloads}updates${channel}.json`;

  return JSON.stringify(manifest, undefined, 2);
}
