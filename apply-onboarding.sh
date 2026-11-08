#!/bin/bash
# Run from the project root after unzipping. Then run supabase/017_onboarding.sql in the Supabase SQL editor.
set -e
[ -f app/areamanager/page.tsx ] || { echo "STOP: run this from the project root."; exit 1; }
rm -f app/areamanager/OrdersPanel.tsx
echo "Onboarding files in place. Next: npm run build, then run supabase/017_onboarding.sql in Supabase."
