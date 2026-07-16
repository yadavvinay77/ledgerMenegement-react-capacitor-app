# Changelog

## v0.2.2

- Fixed Assistant intent ordering so "add/log transaction" commands are parsed as transaction drafts instead of being treated as statement navigation.
- Added offline natural-language parsing for common milk ledger commands, including party names, milk type, quantity, sample weight, rate, paid/credit/udhaar status, and simple dates.
- Improved statement commands so the assistant opens the requested party statement with the parsed date range.
- Added sample-weight editing and safer validation to the assistant confirmation card before saving.

## v0.2.1

- Reworked the app shell to use the full mobile/tablet viewport instead of a fixed phone-width frame.
- Updated modal, popup, share sheet, and assistant windows to fit portrait and landscape orientations.
- Improved safe-area handling for headers, bottom navigation, floating action button, invoice view, and scrollable dialogs.
- Verified the updated APK on the connected 1600x2560 Android tablet in portrait and landscape.

## v0.2.0

- Updated the app from `MilkLedger_1.jsx`.
- Added the richer Account area with business profile, backups, security, language, and activity log screens.
- Added date-range dashboard transaction exports.
- Restored native Android file sharing for CSV, JSON backup, image, and PDF exports through Capacitor.
- Added generated PDF statement/history/dashboard exports with previous balance and total rows.
- Built and installed the updated debug APK on the connected Android device.

## v0.1.0

- Initial React + Capacitor Android release.
- Added responsive mobile/tablet ledger screens, statement totals, native sharing, and Android project setup.
