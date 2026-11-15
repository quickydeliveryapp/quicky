#!/bin/bash
# Clears the leftover patch scripts and unused override files from the project root and components/.
# Only touches the files listed below, and only removes a CSS file when nothing imports it.
cd "$(dirname "$0")" 2>/dev/null || true
[ -d app ] || { echo "STOP: run this from the project root (the folder that contains app/)."; exit 1; }

removed=0
rm_file() { if [ -e "$1" ]; then rm -f "$1" && echo "removed $1" && removed=$((removed+1)); fi; }

# 1) one-time patch scripts and notes
for f in apply-*.sh apply-*.js cleanup.sh README.txt sidebar.css category-images.css; do rm_file "$f"; done

# 2) override stylesheets from earlier experiments, only if nothing imports them
for css in components/dash-rows.css components/dash-sharp.css; do
  name=$(basename "$css")
  if [ -e "$css" ]; then
    if grep -rq "$name" app components lib 2>/dev/null; then echo "kept $css (it is still imported somewhere)"; else rm_file "$css"; fi
  fi
done

echo "Done. $removed file(s) removed. Now run: npm run build"
