#!/bin/bash
pkill -f node
pkill -o chromium

cd /home/kiosk/MedisKiosk
node /home/kiosk/MedisKiosk/app.js &
export DISPLAY=:0
sleep 3
chromium-browser --kiosk --start-maximized --fast --fast-start --no-sandbox --no-first-run --disk-cache-dir=/dev/null --ozone-platform=wayland --noerrdialog --disable-gpu --disable-infobars --disable-popup-blocking --autoplay-policy=no-user-gesture-required --disable-features=Translate  https://s-kvs01.fntn.sk:6400/amb/111
kanshi &