# Unloop — Privacy Policy

**Last updated:** 2026-09-25  
**Contact:** unloopyourself.dev@gmail.com  
**App package:** `io.github.unloopyourself.unloop`

Unloop is a privacy-first, open-source Android app that briefly interrupts doomscrolling with a short on-device challenge. This policy explains what the app does with data.

## Summary

- Unloop does **not** require an account.
- Unloop does **not** include analytics, advertising, or crash-reporting SDKs that send behavioral data off-device.
- Usage monitoring and challenge progress stay **on your device**.
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

This processing happens **locally**. Unloop’s product intent is not to build a cloud profile of what you watch.

## Data we do not collect

By default Unloop does **not**:

- Create user accounts or profiles
- Upload your usage history, challenge results, or feed choices to Unloop servers
- Sell or share personal data with advertisers
- Embed third-party analytics / behavioral telemetry SDKs

Future optional features (for example a privacy-preserving Buddy relay described in project docs) will only send what that feature strictly needs, with separate user action and documentation. They are **not** part of the current Android MVP.

## Permissions

Permissions are requested so the interrupt loop can work as you configured it. You can deny or revoke them in Android Settings; monitoring simply will not work until required permissions are granted again.

## Children

Unloop is not directed at children under 13. Do not use the app if you are under the applicable age for digital wellbeing tools in your region without a parent/guardian.

## Changes

We may update this policy as the app evolves. The “Last updated” date above will change. Material privacy changes will be reflected in the open-source repository and this page.

## Contact

Questions: **unloopyourself.dev@gmail.com**  
Source: [github.com/unloopyourself/unloop-yourself](https://github.com/unloopyourself/unloop-yourself)
