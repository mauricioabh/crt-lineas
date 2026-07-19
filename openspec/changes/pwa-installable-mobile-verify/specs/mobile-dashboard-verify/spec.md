## ADDED Requirements

### Requirement: Mobile dashboard presents a list instead of the dense table

On viewports below the `md` breakpoint, the dashboard SHALL present company links as a compact list (or cards) rather than the full multi-column data table used on desktop.

#### Scenario: Narrow viewport shows list

- **WHEN** an authenticated user views the dashboard on a viewport narrower than `md`
- **THEN** the primary company-link listing SHALL be a vertical list/cards UI and MUST NOT require horizontal scrolling of a full desktop table as the primary interaction

#### Scenario: Wide viewport keeps the table

- **WHEN** an authenticated user views the dashboard on a viewport at or above `md`
- **THEN** the existing companies data table (including column visibility and bulk controls as today) SHALL remain available

### Requirement: Mobile user can open a link detail and run individual verification

On the mobile list, the user SHALL be able to open a detail surface for a company link and trigger the same individual verification flow used on desktop when the link is eligible.

#### Scenario: Open detail from list row

- **WHEN** the user activates a list row on the mobile dashboard
- **THEN** the system SHALL show a detail surface with enough context to identify the company/link and its verification-related status

#### Scenario: Eligible link can be verified

- **WHEN** the user taps Verify on a detail surface for an enabled link with automated verification status `yes`
- **THEN** the system SHALL invoke the existing individual monitor verification path (`POST /api/monitor/:linkId` or equivalent) and show in-progress feedback until the request completes

#### Scenario: Ineligible link cannot be verified

- **WHEN** the link is disabled or does not support automated verification
- **THEN** the Verify action SHALL be disabled or unavailable with a clear reason consistent with desktop behavior

### Requirement: Mobile toolbar supports finding a link without bulk verify

The mobile dashboard SHALL provide search (and compact filtering as needed) so the user can find a link. Bulk verification MUST NOT be required for the mobile verification workflow.

#### Scenario: Search narrows the mobile list

- **WHEN** the user enters a search query on the mobile dashboard
- **THEN** the list SHALL update to show matching company links

#### Scenario: Bulk is not the primary mobile path

- **WHEN** the user is on the mobile dashboard viewport
- **THEN** bulk multi-select verification SHALL be hidden or non-primary so individual verification remains the default path
