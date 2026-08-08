(function() {
  var endpoints = Object.freeze({
    "localApiBase": "http://127.0.0.1:47111/api",
    "productionApiBase": "https://api.leerpretpark.nl/api"
  });
  var isLocal = typeof window !== "undefined" && (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
  window.PHILE_CONFIG = Object.freeze({
    apiBase: isLocal ? endpoints.localApiBase : endpoints.productionApiBase,
    clientId: "phile"
  });
})();
