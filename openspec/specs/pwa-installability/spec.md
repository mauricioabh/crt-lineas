# pwa-installability

## Purpose

Criterios para que la app sea instalable como PWA (manifest, iconos, display standalone) sin service worker ni comportamiento offline.

## Requirements

### Requirement: App is installable without offline support

The system SHALL expose a valid web app manifest and install icons so that a supported browser can install or add the application to the home screen. The system MUST NOT require a service worker or provide offline application functionality in this capability.

#### Scenario: Manifest is available over HTTPS

- **WHEN** a client requests the web app manifest for the deployed application
- **THEN** the response SHALL include at least `name` or `short_name`, `start_url`, `display` set to `standalone` (or an equivalent installable display mode), and icons of at least 192px and 512px

#### Scenario: Document metadata supports installation

- **WHEN** a user opens the application in a browser
- **THEN** the document metadata SHALL include theme color and Apple web app metadata sufficient for home-screen presentation on supported platforms

#### Scenario: No offline shell is promised

- **WHEN** the device has no network connectivity after install
- **THEN** the application is NOT required to render a cached offline experience or queue monitor actions locally
