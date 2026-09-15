#!/usr/bin/env bash
# Turns raw simulator captures into App Store screenshots.
#
#   scripts/store-screenshots/compose-all.sh [raw-dir] [out-dir]
#
# Expects raw captures named <device>-<screen>.png, where <device> is
# "phone" (an iPhone 14 Plus simulator: 1284 x 2778) or "ipad" (an iPad
# Air 13-inch: 2048 x 2732), and <screen> is one of the names below.
# Missing captures are skipped. See docs/release-ios.md for how the
# captures are taken (seeded demo books, status bar override, deep links).
set -euo pipefail
cd "$(dirname "$0")/../.."
raw=${1:-build/store/raw}
out=${2:-build/store/out}
mkdir -p "$out"

# screen|headline|subline — order is the order they should appear in the store.
# DEVICE is replaced with "phone" or "iPad".
screens=(
  "home|Your club's books, on your DEVICE.|Balances, dues progress, and who is behind, at a glance."
  "dues|Who has paid. Who hasn't.|One tap to filter, one tap to record."
  "payment|Record dues in one sheet.|Several members on one check, amounts prefilled."
  "members|The roster, one tap from a call.|Add people by hand, from Contacts, or from a spreadsheet."
  "member|Every member's full history.|Owed, paid, or waived, month by month."
  "ledger|A checkbook you can trust.|Categories, transfers, a running balance, and reconciliation."
  "reports|The treasurer's report, ready to share.|Read it at the meeting or send the PDF."
  "backups|Nothing leaves your DEVICE.|Daily snapshots in the Files app. No cloud, no account."
)

n=0
for entry in "${screens[@]}"; do
  n=$((n + 1))
  IFS='|' read -r screen headline subline <<<"$entry"
  for device in phone ipad; do
    src="$raw/$device-$screen.png"
    [ -f "$src" ] || continue
    case $device in
      phone) size="1284 2778"; word="phone" ;;
      ipad) size="2048 2732"; word="iPad" ;;
    esac
    # shellcheck disable=SC2086
    swift scripts/store-screenshots/compose.swift "$src" "$out/$device-$n-$screen.png" $size "${headline//DEVICE/$word}" "${subline//DEVICE/$word}"
  done
done
