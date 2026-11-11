#!/bin/bash
# Removes a leftover file from an earlier attempt (it was never switched on).
rm -f components/dash-rows.css apply-rows.js
echo "Cleaned up. Now run: npm run build"
