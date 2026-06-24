#!/usr/bin/env bash
# Install node modules
npm install

# Force puppeteer to download Chrome into our configured cache directory
npx puppeteer browsers install chrome
