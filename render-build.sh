#!/bin/bash

# Install dependencies in backend
cd backend
npm install
npx playwright install chromium

# Build the backend
npm run build

# Go to frontend and install
cd ../frontend
npm install
npm run build
