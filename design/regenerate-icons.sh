#!/usr/bin/env bash
# Regenerate every raster icon Expo needs from the SVG sources in design/.
#
# Uses macOS QuickLook to rasterise, the only SVG renderer present by
# default (no ImageMagick, rsvg, or Inkscape needed). QuickLook always
# emits opaque RGBA on white, so two Swift helpers finish the job:
# flatten-icon.swift drops the alpha channel for the iOS icon (App Store
# Connect rejects alpha), and mask-to-alpha.swift turns a white-on-black
# mask into a coloured shape on transparency for the Android and splash
# assets.
#
#   ./design/regenerate-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."

gen() { # source, size, destination
  local tmp; tmp=$(mktemp -d)
  qlmanage -t -s "$2" -o "$tmp" "$1" >/dev/null 2>&1
  cp "$tmp/$(basename "$1").png" "$3"
  rm -rf "$tmp"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# iOS app icon: full-bleed source, flattened to drop the alpha channel.
gen design/icon-app.svg 1024 "$tmp/icon.png"
swift design/flatten-icon.swift "$tmp/icon.png" assets/icon.png

# Android adaptive icon: the mark on transparent (the source keeps it inside
# the central 66% safe zone), the gradient as background, and a white mark
# for the monochrome/themed variant.
gen design/icon-mark.svg 1024 "$tmp/mark.png"
swift design/mask-to-alpha.swift "$tmp/mark.png" '#ffffff' assets/android-icon-foreground.png
swift design/mask-to-alpha.swift "$tmp/mark.png" '#ffffff' assets/android-icon-monochrome.png
gen design/icon-background.svg 1024 assets/android-icon-background.png

# Splash mark (green on transparent) and the web favicon.
swift design/mask-to-alpha.swift "$tmp/mark.png" '#2e7d46' assets/splash-icon.png
gen design/icon-app.svg 64 assets/favicon.png

for f in assets/icon.png assets/android-icon-*.png assets/splash-icon.png assets/favicon.png; do
  printf '  %-36s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight -g hasAlpha "$f" | awk '/pixel|hasAlpha/ {printf "%s ", $2}')"
done
