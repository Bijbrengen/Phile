from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RepositoryBoundaryTests(unittest.TestCase):
    def test_runtime_has_no_sibling_repository_paths(self) -> None:
        runtime = "\n".join(
            (ROOT / name).read_text(encoding="utf-8")
            for name in ("index.html", "bootstrap.js", "script.js", "style.css")
        ).lower()
        for forbidden in ("../leerpretengine", "../leerpret", "d:\\repos", "localhost:47111"):
            self.assertNotIn(forbidden, runtime)

    def test_no_local_content_database_or_sdk_copy(self) -> None:
        self.assertFalse((ROOT / "philosophers.json").exists())
        self.assertFalse((ROOT / "sdk").exists())


if __name__ == "__main__":
    unittest.main()
