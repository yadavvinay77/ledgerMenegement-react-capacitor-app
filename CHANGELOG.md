# Changelog

## v0.4.0

- Added explicit Apply and Clear buttons for dashboard and party statement date filters.
- Added assistant voice input, voice reply toggle, and replay buttons for assistant responses.
- Expanded assistant quick actions for purchase/sale entries, payments, lending navigation, summaries, and statement guidance.
- Added edit actions for lending borrower profiles and loan details, including principal, rate, interest type, guarantor, collateral, and notes.
- Improved sharing feedback and capped JPG statement rendering for faster Android sharing while keeping full-detail PDF/CSV statements.

## v0.3.2

- Updated simple-interest loan methodology so deposits reduce the active interest base and added principal increases it for future monthly rows.
- Added an Add Principal action in loan accounts for top-up lending entries.
- Added borrower and loan delete actions with confirmation dialogs.
- Added full loan statement sharing in PDF and JPG, alongside CSV/text, with business profile, borrower profile, loan terms, summary cards, and full ledger rows.
- Expanded loan CSV statements with business/borrower profile details and settlement summary fields.

## v0.3.1

- Updated loan ledgers to auto-display every monthly interest row from the loan start date through today.
- Added a running balance column to the loan ledger table.
- Updated simple/compound loan balances so old accounts reflect accumulated monthly interest instead of a single projected row.
- Added loan statement sharing/export for full loan progress.

## v0.3.0

- Added a new Lending tab for borrower profiles and interest-based loan accounts.
- Added loan creation with principal, start date, simple/compound interest, monthly rate, duration, guarantor, collateral/guarantee, and notes.
- Added loan ledger entries for disbursement, deposits, monthly interest posting, and settlement.
- Added simple-interest and compound-interest balance calculations with projected next interest and settlement amount.
- Included lending borrowers and loans in JSON backup/restore.

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
