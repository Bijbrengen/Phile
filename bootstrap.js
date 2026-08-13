(function () {
  "use strict";

  const status = document.getElementById("runtimeStatus");
  const queryApi = new URLSearchParams(location.search).get("api");
  const apiBase = String(queryApi || window.PHILE_CONFIG?.apiBase || "").replace(/\/+$/, "");
  const clientId = window.PHILE_CONFIG?.clientId || "phile";

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = () => reject(new Error(`SDK-asset kon niet worden geladen: ${url}`));
      document.head.appendChild(script);
    });
  }

  async function start() {
    if (!apiBase) throw new Error("PHILE_CONFIG.apiBase ontbreekt");
    await loadScript(`${apiBase}/sdk/sdk-loader/loader.js`);
    const loader = LeerpretSDK.Loader.create({ base: apiBase });
    await loader.load(["api-client", "auth-client", "leerobject"]);
    const client = LeerpretSDK.create({ apiBase, clientId });
    await client.bootstrap();
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
    window.PHILE_BOOTSTRAP = Object.freeze({ apiBase, client, manifest: loader.manifest });
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
