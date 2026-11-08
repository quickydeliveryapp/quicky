#!/bin/bash
# Run from the project root (~/Downloads/quicky). Adds the deposit QR panel to the area manager page and to the admin "Rider cash" tab.
set -e
AM=app/areamanager/page.tsx
AD=app/admin/page.tsx
for f in "$AM" "$AD" app/areamanager/DepositPanel.tsx; do
  [ -f "$f" ] || { echo "STOP: $f not found. Run this from the project root."; exit 1; }
done

# ---- area manager page ----
if grep -q "DepositPanel" "$AM"; then
  echo "Area manager page already has the deposit panel."
else
  grep -q 'import OrdersPanel from "./OrdersPanel";' "$AM" && grep -q '<OrdersPanel people={rows} />' "$AM" \
    || { echo "STOP: $AM is not the page I expected."; exit 1; }
  perl -0pi -e 's|import OrdersPanel from "\./OrdersPanel";|import OrdersPanel from "./OrdersPanel";\nimport DepositPanel from "./DepositPanel";|; s|(\s*)<OrdersPanel people=\{rows\} />|$1<DepositPanel />$1<OrdersPanel people={rows} />|' "$AM"
  grep -q "<DepositPanel />" "$AM" && grep -q 'import DepositPanel' "$AM" || { echo "STOP: could not edit $AM"; exit 1; }
  echo "Added the deposit panel to $AM"
fi

# ---- admin page ----
if grep -q "DepositPanel" "$AD"; then
  echo "Admin page already has the deposit panel."
else
  grep -q 'import HeroAdmin from "@/components/HeroAdmin";' "$AD" && grep -q '{tab === "cash" && (cash.length === 0' "$AD" \
    || { echo "STOP: $AD is not the page I expected."; exit 1; }
  perl -0pi -e 's|import HeroAdmin from "\@/components/HeroAdmin";|import HeroAdmin from "\@/components/HeroAdmin";\nimport DepositPanel from "../areamanager/DepositPanel";|; s|(\n\s*)(\{tab === "cash" && \(cash\.length === 0)|$1\{tab === "cash" && <DepositPanel />\}$1$2|' "$AD"
  grep -q '<DepositPanel />' "$AD" && grep -q 'import DepositPanel' "$AD" || { echo "STOP: could not edit $AD"; exit 1; }
  echo "Added the deposit panel to $AD"
fi
echo "Done. Now run supabase/016_admin_qr.sql in the Supabase SQL editor."
