#!/bin/bash
# Run from the project root. Adds the deposit panel to the area manager page, then copies the new files.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
F=app/areamanager/page.tsx
if [ ! -f "$F" ]; then echo "STOP: $F not found"; exit 1; fi
if grep -q "DepositPanel" "$F"; then
  echo "Area manager page already has the deposit panel."
else
  if ! grep -q 'import OrdersPanel from "./OrdersPanel";' "$F" || ! grep -q '<OrdersPanel people={rows} />' "$F"; then
    echo "STOP: $F is not the page I expected. Send it to Claude first."; exit 1; fi
  perl -0pi -e 's|import OrdersPanel from "\./OrdersPanel";|import OrdersPanel from "./OrdersPanel";\nimport DepositPanel from "./DepositPanel";|; s|(\s*)<OrdersPanel people=\{rows\} />|$1<DepositPanel />$1<OrdersPanel people={rows} />|' "$F"
  if ! grep -q "<DepositPanel />" "$F" || ! grep -q 'import DepositPanel' "$F"; then echo "STOP: could not add the panel to $F"; exit 1; fi
  echo "Added the deposit panel to $F"
fi
cp -R "$SRC/app" .
echo "Deposit feature files copied."
