from __future__ import annotations

import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


defaults = dotenv(ROOT / ".env.example")
local = dotenv(ROOT / ".env")
config = {
    "localApiBase": os.getenv("LEERPRET_API_URL") or local.get("LEERPRET_API_URL") or defaults["LEERPRET_API_URL"],
    "productionApiBase": os.getenv("LEERPRET_PRODUCTION_API_URL") or local.get("LEERPRET_PRODUCTION_API_URL") or defaults["LEERPRET_PRODUCTION_API_URL"],
}
serialized = json.dumps(config, ensure_ascii=False, indent=2).replace("\n", "\n  ")
payload = f"""(function() {{
  var endpoints = Object.freeze({serialized});
  var isLocal = typeof window !== "undefined" && (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
  window.PHILE_CONFIG = Object.freeze({{
    apiBase: isLocal ? endpoints.localApiBase : endpoints.productionApiBase,
    clientId: "phile"
  }});
}})();
"""
(ROOT / "runtime-config.js").write_text(payload, encoding="utf-8")
print("Runtimeconfiguratie geschreven voor lokaal en productie")
