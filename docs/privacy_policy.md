# Unloop — Privacy Policy

**Last updated:** 2026-11-26  
**Contact:** unloopyourself.dev@gmail.com  
**App package:** `io.github.unloopyourself.unloop`

Unloop is a privacy-first, open-source Android app that briefly interrupts doomscrolling with a short on-device challenge. This policy explains what the app does with data.

## Summary

- Unloop does **not** require an account.
- Unloop does **not** include analytics, advertising, or crash-reporting SDKs that send behavioral data off-device.
- Usage monitoring and challenge progress stay **on your device**.
- Optional **Buddy** features (off by default) use a stateless relay and push transport as described below.
- You can revoke Android permissions or uninstall at any time.

## Data we process on the device

To interrupt selected apps after a time threshold you choose, Unloop may use:

| On-device processing | Why |
|----------------------|-----|
| **Usage Access** (UsageStats) | Detect when a watched app is in the foreground and accumulate time toward your threshold |
| **Display over other apps** (overlay) | Show the interrupt / challenge UI over the feed |
| **Foreground service + notification** | Keep monitoring reliable while you use other apps (Android requirement) |
| **Sensors** (accelerometer / gyroscope) | Optional physical challenges you enable (e.g. shake, coin spin, air write) |
| **Local settings & audit log** | Remember feeds, timings, enabled challenges; optional local debug/audit entries |
| **Local Buddy pairing records** (optional) | Store invite fingerprints / mailbox ids you accept on this device |
| **Camera / mic / photos (optional)** | Only if you compose a Buddy media nudge (photo, GIF, short voice ≤30s, short video ≤10s) |

This processing happens **locally**. Unloop’s product intent is not to build a cloud profile of what you watch.

## Optional Buddy / push (off by default)

If you enable Buddy features in Settings:

| Off-device piece | What it carries | What it must not do |
|------------------|-----------------|---------------------|
| **Cloudflare Worker relay** | Opaque mailbox blobs (short TTL), push-token ↔ mailbox routing ids | No plaintext message store, no usage profiles, no analytics product |
| **Firebase Cloud Messaging** | Opaque data pushes to wake a paired device | No Firebase Analytics / Crashlytics / advertising SDKs in the Unloop app |

### Short-TTL media nudges

When you send a Buddy media nudge, the ciphertext blob may include a short photo, GIF, voice clip, or video (hard size/duration caps). The relay holds that blob only for a **short TTL** as a postman—there is **no long-term media gallery or cloud library** on Unloop servers. Media is encoded on device; oversize content is rejected rather than uploaded raw (no 4K dumps).

Buddy invites are shared via OS share / QR / deep link. Unloop does **not** upload your address book. You can revoke a pairing on-device; tokens can be forgotten on the relay.

## Data we do not collect

By default Unloop does **not**:

- Create user accounts or profiles
- Upload your usage history, challenge results, or feed choices to Unloop servers
- Sell or share personal data with advertisers
- Embed third-party analytics / behavioral telemetry SDKs

## Permissions

Permissions are requested so the interrupt loop can work as you configured it. You can deny or revoke them in Android Settings; monitoring simply will not work until required permissions are granted again.

Optional Buddy media may also request **camera**, **microphone**, and **photos/videos** access. Denying them only disables composing those nudge types; the core interrupt loop does not require them.

## Children

Unloop is not directed at children under 13. Do not use the app if you are under the applicable age for digital wellbeing tools in your region without a parent/guardian.

## Changes

We may update this policy as the app evolves. The “Last updated” date above will change. Material privacy changes will be reflected in the open-source repository and this page.

## Contact

Questions: **unloopyourself.dev@gmail.com**  
Source: [github.com/unloopyourself/unloop-yourself](https://github.com/unloopyourself/unloop-yourself)
