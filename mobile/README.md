# OrbytMax Mobile

Native Expo Router companion for the OrbytMax Next.js satellite tracker.

## Run with Expo Go

1. Start the Next.js API from the repository root on your LAN:
   `npm.cmd run dev -- --hostname 0.0.0.0 --port 3001`
2. Copy `.env.example` to `.env` and replace the IP with your computer's current LAN IPv4 address.
3. Start Expo:
   `npm.cmd start -- --lan`
4. Scan the terminal QR code with Expo Go.

The phone and computer must be on the same Wi-Fi network. `EXPO_PUBLIC_API_URL` must use the computer's LAN IP, not `localhost`.
