#!/usr/bin/env python3
"""
apply_toast_patch.py
Run from the ROOT of your Ultimate CAD project:
    python3 apply_toast_patch.py

Adds toast.css and toast.js to every public HTML page so all
alert() calls are automatically displayed as toast notifications.
"""

import re, sys
from pathlib import Path

PAGES = [
    "index.html",
    "dashboard.html",
    "server-page.html",
    "server-settings.html",
    "settings.html",
    "leo-cad.html",
    "fr-cad.html",
    "dot-cad.html",
    "dispatcher-cad.html",
    "civilian.html",
]

CSS_TAG = '  <link rel="stylesheet" href="css/toast.css">\n'

def patch(html: str) -> str:
    if "toast.css" in html:
        return None  # already patched

    # 1. Inject CSS before </head>
    html = html.replace("</head>", CSS_TAG + "</head>", 1)

    # 2. Inject toast.js before the last <script src="js/...">
    #    Uses rfind so we always insert before the page-specific script.
    idx = html.rfind('\n<script src="js/')
    if idx != -1:
        html = html[:idx] + '\n<script src="js/toast.js"></script>' + html[idx:]

    return html


def main():
    root = Path(".")
    pub  = root / "public"

    if not pub.is_dir():
        print("ERROR: 'public/' directory not found. Run from the project root.", file=sys.stderr)
        sys.exit(1)

    for page in PAGES:
        path = pub / page
        if not path.exists():
            print(f"  SKIP  {page}  (file not found)")
            continue

        original = path.read_text(encoding="utf-8")
        patched  = patch(original)

        if patched is None:
            print(f"  SKIP  {page}  (already patched)")
            continue

        path.write_text(patched, encoding="utf-8")
        print(f"  OK    {page}")

    print("\nDone.")


if __name__ == "__main__":
    main()