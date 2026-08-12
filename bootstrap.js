(function () {
  "use strict";

  const status = document.getElementById("runtimeStatus");
  const queryApi = new URLSearchParams(location.search).get("api");
  const apiBase = String(queryApi || window.PHILE_CONFIG?.apiBase || "").replace(/\/+$/, "");
  const clientId = window.PHILE_CONFIG?.clientId || "phile";

  function loadScript(url, integrity) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.crossOrigin = "anonymous";
      if (integrity) script.integrity = integrity;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`SDK-asset kon niet worden geladen: ${url}`));
      document.head.appendChild(script);
    });
  }

  async function start() {
    if (!apiBase) throw new Error("PHILE_CONFIG.apiBase ontbreekt");
    const manifestResponse = await fetch(`${apiBase}/sdk/manifest.json`, { mode: "cors", cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`SDK-manifest gaf HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const apiAsset = manifest.components?.["api-client"]?.assets?.["client.js"];
    const authAsset = manifest.components?.["auth-client"]?.assets?.["client.js"];
    const objectAsset = manifest.components?.leerobject?.assets?.["client.js"];
    if (!apiAsset || !authAsset || !objectAsset) throw new Error("LeerpretSDK mist api-client, auth-client of leerobject");
    await loadScript(`${apiBase}/sdk/api-client/client.js`, manifest.components["api-client"].integrity?.["client.js"]);
    const client = LeerpretSDK.create({ apiBase, clientId });
    await client.bootstrap();
    await loadScript(`${apiBase}/sdk/auth-client/client.js`, manifest.components["auth-client"].integrity?.["client.js"]);
    const auth = LeerpretSDK.components["auth-client"].client;
    await auth.completeGoogleLogin({ apiBase, sdkClient: client });
    const access = await auth.ensureSessionAccess({ apiBase, sdkClient: client });
    if (access.action === "login") {
      auth.mountLogin(document.body, {
        apiBase,
        sdkClient: client,
        title: "Inloggen bij Phile",
        message: "Meld je hier met Google aan om Phile te spelen."
      });
      return;
    }
    if (access.action !== "allow") throw new Error("De aanmeldstatus kon niet worden gecontroleerd");
    await loadScript(`${apiBase}/sdk/leerobject/client.js`, manifest.components.leerobject.integrity?.["client.js"]);
    window.PHILE_BOOTSTRAP = Object.freeze({ apiBase, client, manifest });
    document.body.dataset.runtime = "ready";
    const game = document.createElement("script");
    game.src = "script.js";
    game.onerror = () => { throw new Error("Phile-spellogica kon niet worden geladen"); };
    document.body.appendChild(game);
  }

  start().catch(error => {
    document.body.dataset.runtime = "unavailable";
    status.textContent = `LeerpretEngine niet beschikbaar: ${error.message}`;
  });
})();
