# Byte Commander License Server

Ein professionelles, flexibles und sicheres Software-Lizenzsystem mit 2FA-Authentifizierung, Admin-Portal und Python SDK für die Integration in bestehende Anwendungen.

**Offizielle Website:** [app.byte-commander.de](https://app.byte-commander.de)

## Anleitungen

| Zielgruppe | Dokument |
|---|---|
| **Lizenz-Administrator** | [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md) |
| **Software-Nutzer (Endanwender)** | [docs/ANLEITUNG_SOFTWARENUTZER.md](docs/ANLEITUNG_SOFTWARENUTZER.md) |
| **Entwickler / Integration** | [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) |
| **Dokumentations-Index** | [docs/README.md](docs/README.md) |

---

## 📋 Inhaltsverzeichnis

- [Überblick](#überblick)
- [Features](#features)
- [Systemarchitektur](#systemarchitektur)
- [Installation](#installation)
- [Schnellstart](#schnellstart)
- [Lizenzmodelle](#lizenzmodelle)
- [2FA-Authentifizierung](#2fa-authentifizierung)
- [API-Dokumentation](#api-dokumentation)
- [Python SDK](#python-sdk)
- [Admin-Portal](#admin-portal)
- [Deployment](#deployment)
- [Konfiguration](#konfiguration)
- [Entwicklung](#entwicklung)
- [Sicherheit](#sicherheit)
- [Troubleshooting](#troubleshooting)
- [Lizenz](#lizenz)

---

## 🎯 Überblick

Das **Byte Commander License Server** ist ein umfassendes Lizenzverwaltungssystem, das Softwareentwicklern ermöglicht, ihre Produkte mit flexiblen Lizenzmodellen zu schützen. Das System unterstützt mehrere Lizenztypen (Abonnements, perpetuelle Lizenzen, gerätebasiert), 2FA-geschützte Aktivierungen und bietet eine benutzerfreundliche Admin-Oberfläche sowie SDKs für verschiedene Plattformen.

### Hauptmerkmale:
- **Flexible Lizenzmodelle:** Abonnements, perpetuelle Lizenzen, gerätebasierte und benutzerbasierte Lizenzen
- **2FA-Sicherheit:** Google Authenticator Integration für sichere Lizenzaktivierungen
- **Multi-Platform:** Unterstützung für Web, Python, Node.js und andere Plattformen
- **Admin-Portal:** Vollständige Verwaltungsoberfläche für Produkte, Lizenzen und Kunden
- **Offline-Validierung:** Lizenzen können offline validiert werden (bis zu 7 Tage)
- **REST API:** Umfassende tRPC/REST API für Integration in bestehende Systeme
- **Skalierbar:** Gebaut auf modernen Technologien (Express, React, Drizzle ORM)

---

## ✨ Features

### Lizenzmanagement
- ✅ **Mehrere Lizenztypen:** Abonnement, Perpetual, Device-based, User-based, Feature-based
- ✅ **Automatische Generierung:** Eindeutige Lizenzschlüssel mit Checksummen-Validierung
- ✅ **Ablauf-Management:** Automatische Verwaltung von Lizenzablauf und Erneuerung
- ✅ **Aktivierungsverfolgung:** Detaillierte Logs aller Aktivierungen und Validierungen
- ✅ **Lizenz-Widerruf:** Möglichkeit, Lizenzen zu sperren oder zu widerrufen

### Sicherheit
- ✅ **2FA mit Google Authenticator:** TOTP-basierte Authentifizierung bei Lizenzaktivierung
- ✅ **JWT-Token:** Sichere, signierte Tokens für Offline-Validierung
- ✅ **Rate Limiting:** Schutz vor Brute-Force-Angriffen
- ✅ **Token Blacklisting:** Verwaltung ungültiger Tokens
- ✅ **HTTPS/TLS:** Verschlüsselte Kommunikation
- ✅ **Sichere Speicherung:** Gehashed Passwörter, sichere Datenbank-Konfiguration

### Admin-Portal
- ✅ **Dashboard:** Übersichtsstatistiken und Echtzeit-Metriken
- ✅ **Produktverwaltung:** Erstellen, bearbeiten und löschen von Produkten
- ✅ **Lizenzverwaltung:** Vollständige CRUD-Operationen für Lizenzen
- ✅ **Kundenverwaltung:** Verwaltung von Kundeninformationen
- ✅ **Aktivierungsverlauf:** Detaillierte Logs aller Aktivierungen
- ✅ **2FA-Konfiguration:** Aktivieren/Deaktivieren von 2FA pro Produkt

### Integration
- ✅ **Python SDK:** Vollständige Python-Bibliothek mit 2FA-Unterstützung
- ✅ **REST API:** Standardisierte API-Endpoints
- ✅ **tRPC:** Type-safe RPC für Web-Anwendungen
- ✅ **Webhook-Support:** (Geplant) Ereignisbenachrichtigungen

---

## 🏗️ Systemarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  (Python, Node.js, Web, Desktop, Mobile)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ REST/tRPC API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              License Server (Backend)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Express.js + tRPC                                  │   │
│  │  - License Activation                               │   │
│  │  - License Validation                               │   │
│  │  - 2FA Management                                   │   │
│  │  - Product Management                               │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MySQL/TiDB + Drizzle ORM                           │   │
│  │  - Users, Products, Licenses                        │   │
│  │  - Activations, 2FA Settings                        │   │
│  │  - Audit Logs                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Admin Portal (Frontend)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React 19 + Tailwind CSS                            │   │
│  │  - Dashboard                                        │   │
│  │  - Product Management                               │   │
│  │  - License Management                               │   │
│  │  - Customer Management                              │   │
│  │  - Activation Logs                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Voraussetzungen

- **Node.js:** 18.0.0 oder höher
- **pnpm:** 8.0.0 oder höher (oder npm/yarn)
- **MySQL/TiDB:** 5.7 oder höher
- **Git:** 2.30.0 oder höher

### Repository klonen

```bash
git clone https://github.com/TheRealByteCommander/software-licensing-concept.git
cd software-licensing-concept
```

### Abhängigkeiten installieren

```bash
pnpm install
```

### Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env.local` Datei im Root-Verzeichnis:

```env
# Datenbank
DATABASE_URL=mysql://user:password@localhost:3306/license_db

# OAuth (Manus)
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# Sicherheit
JWT_SECRET=your-secret-key-min-32-chars

# Anwendung
VITE_APP_TITLE=Byte Commander License Server
VITE_APP_LOGO=https://your-domain.com/logo.png

# Owner
OWNER_NAME=Your Name
OWNER_OPEN_ID=your-open-id
```

### Datenbank initialisieren

```bash
pnpm db:push
```

Dies erstellt alle notwendigen Tabellen und Migrationen.

### Entwicklungsserver starten

```bash
pnpm dev
```

Der Server läuft dann unter `http://localhost:3000`

---

## 🚀 Schnellstart

### 1. Produkt erstellen

Melden Sie sich im Admin-Portal an und navigieren Sie zu **Products**:

```
Products → Add Product
- Name: "Meine Software"
- Description: "Eine großartige Software"
```

Optional 2FA einrichten: **Products → Shield-Symbol → Setup 2FA → Enable requirement**
(Vollständige Schritte: [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md))

### 2. Lizenz generieren

Navigieren Sie zu **Licenses** und erstellen Sie eine neue Lizenz:

```
Licenses → Create License
- Product: "Meine Software"
- License Type: "Subscription"
- Max Activations: 1
- Expiration Date: 2026-12-31 (optional)
```

### 3. Lizenz aktivieren (Client-Seite)

Mit dem Python SDK:

```python
from licensing_sdk import LicenseClient

client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Aktivieren
result = client.activate()
if result['success']:
    print("Lizenz aktiviert!")

# Validieren
if client.is_valid():
    print("Lizenz ist gültig!")
```

---

## 📜 Lizenzmodelle

Das System unterstützt mehrere flexible Lizenzmodelle:

### 1. **Abonnement (Subscription)**
- **Beschreibung:** Zeitbasierte Lizenz mit Ablaufdatum
- **Ablauf:** Über `expiresAt` / Expiration Date im Admin-Portal
- **Erneuerung:** Manuell (neues Ablaufdatum oder neue Lizenz) – keine automatische Verlängerung im Server
- **Ideal für:** SaaS-Produkte, Cloud-Services

```json
{
  "type": "subscription",
  "expiresAt": "2026-12-31"
}
```

### 2. **Perpetual (Unbefristet)**
- **Beschreibung:** Lizenz ohne Ablaufdatum
- **Ablauf:** Kein Lizenzablauf (JWT-Token für Offline-Nutzung max. 7 Tage gültig)
- **Ideal für:** Desktop-Software, One-Time-Purchase

```json
{
  "type": "perpetual",
  "expiresAt": null
}
```

### 3. **Node Locked (Gerätegebunden)**
- **Beschreibung:** Lizenz ist an registrierte Geräte gebunden (`deviceId`)
- **Aktivierungen:** Über `maxActivations` steuerbar (typisch: 1)
- **Ideal für:** Hardware-gebundene Software, Workstations

```json
{
  "type": "node_locked",
  "maxActivations": 1
}
```

### 4. **User-Based (Benutzerbasiert)**
- **Beschreibung:** Mehrere Geräte pro Lizenzschlüssel möglich
- **Aktivierungen:** Über `maxActivations` (> 1) steuerbar
- **Ideal für:** Enterprise-Software, Team-Lizenzen

```json
{
  "type": "user_based",
  "maxActivations": 5
}
```

### 5. **Feature-Based (Funktionsbasiert)**
- **Beschreibung:** Lizenz schaltet Features frei (über `metadata.features`)
- **Features:** Werden im Validierungs-Token zurückgegeben – Auswertung in der Client-Software
- **Ideal für:** Freemium-Modelle, Tiered Pricing

```json
{
  "type": "feature_based",
  "metadata": "{\"features\":[\"basic\",\"advanced\",\"premium\"]}"
}
```

---

## 🔐 2FA-Authentifizierung

Das System implementiert eine sichere 2FA-Authentifizierung mit Google Authenticator (TOTP).

### Wie 2FA funktioniert

**Wichtig:** 2FA ist **nur bei der Lizenzaktivierung auf neuen Geräten** erforderlich, nicht beim Programmstart.

#### Aktivierungsfluss mit 2FA:

```
1. Benutzer startet Programm mit neuer Lizenz
   ↓
2. Client initiiert Aktivierung
   ↓
3. Server prüft: Ist 2FA für dieses Produkt erforderlich?
   ↓
   JA → Weiterleitung zu 2FA-Endpunkt
   NEIN → Normale Aktivierung
   ↓
4. Server generiert QR-Code für Google Authenticator
   ↓
5. Benutzer scannt QR-Code mit Google Authenticator
   ↓
6. Benutzer gibt 6-stelligen Code ein
   ↓
7. Server validiert TOTP-Code
   ↓
8. Lizenz wird aktiviert und Token wird generiert
   ↓
9. Programmstart in Zukunft: Nur Token-Validierung (kein 2FA)
```

### 2FA Setup für Produkte

Im Admin-Portal:

```
Dashboard → Produkte → [Produkt bearbeiten]
2FA erforderlich: ✓ (Checkbox)
```

### 2FA mit Python SDK

```python
from licensing_sdk import LicenseClientWith2FA

client = LicenseClientWith2FA(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Schritt 1: Aktivierung initiieren
activation_result = client.initiate_activation()
if activation_result['success']:
    activation_token = activation_result['activationToken']
    print(f"Bitte scannen Sie den QR-Code in Google Authenticator")
    
    # Schritt 2: TOTP-Code vom Benutzer erhalten
    totp_code = input("Geben Sie den 6-stelligen Code ein: ")
    
    # Schritt 3: Aktivierung mit 2FA bestätigen
    confirm_result = client.confirm_activation_with_2fa(
        activation_token=activation_token,
        totp_code=totp_code
    )
    
    if confirm_result['success']:
        print("✓ Lizenz erfolgreich mit 2FA aktiviert!")
    else:
        print(f"✗ 2FA-Bestätigung fehlgeschlagen: {confirm_result['message']}")
```

### 2FA-Sicherheitsmerkmale

- ✅ **TOTP (Time-based One-Time Password):** Zeitbasierte Codes, gültig für 30 Sekunden
- ✅ **Aktivierungstoken:** 10-Minuten-Ablauf für zusätzliche Sicherheit
- ✅ **Brute-Force-Schutz:** Rate Limiting bei fehlgeschlagenen Versuchen
- ✅ **Backup-Codes:** (Geplant) Wiederherstellungscodes für den Fall, dass Authenticator verloren geht

---

## 📡 API-Dokumentation

### Base URL

```
https://your-license-server.com/api/trpc/
```

### Authentifizierung

- **Admin-Endpoints:** Manus OAuth erforderlich
- **Public-Endpoints:** Keine Authentifizierung erforderlich

### Lizenzaktivierung

#### Normale Aktivierung (ohne 2FA)

**Endpoint:** `POST /api/trpc/api.activate`

**Request:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",
  "deviceInfo": "{\"platform\":\"Linux\",\"version\":\"5.15.0\"}"
}
```

**Response (Erfolg):**
```json
{
  "result": {
    "data": {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Activation successful"
    }
  }
}
```

**Response (Fehler):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid license key"
  }
}
```

### 2FA Aktivierung - Schritt 1: Initiieren

**Endpoint:** `POST /api/trpc/twoFA.initiateActivation`

**Request:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",
  "deviceInfo": "{\"platform\":\"Linux\",\"version\":\"5.15.0\"}"
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "activationToken": "random-token-string",
      "expiresIn": 600,
      "qrCode": "data:image/png;base64,...",
      "message": "Activation initiated. Please provide TOTP code to confirm."
    }
  }
}
```

### 2FA Aktivierung - Schritt 2: Bestätigen

**Endpoint:** `POST /api/trpc/twoFA.confirmActivationWith2FA`

**Request:**
```json
{
  "activationToken": "token-from-step-1",
  "totpCode": "123456"
}
```

**Response (Erfolg):**
```json
{
  "result": {
    "data": {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "2FA verification successful, license activated"
    }
  }
}
```

### Lizenzvalidierung

**Endpoint:** `POST /api/trpc/api.validate`

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceId": "unique-device-identifier"
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "valid": true,
      "licenseKey": "XXXX-XXXX-XXXX-XXXX",
      "productId": 1,
      "expiryDate": "2025-12-31",
      "features": ["basic", "advanced"],
      "message": "License is valid"
    }
  }
}
```

### Lizenzdeaktivierung

**Endpoint:** `POST /api/trpc/api.deactivate`

**Request:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier"
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "message": "License deactivated successfully"
    }
  }
}
```

### Produktmanagement (Admin)

**Endpoint:** `POST /api/trpc/products.create` (Authentifizierung erforderlich)

**Request:**
```json
{
  "name": "Meine Software",
  "description": "Eine großartige Software",
  "require2FA": true
}
```

Weitere Admin-Endpoints finden Sie in der `API_DOCUMENTATION.md`

---

## 🐍 Python SDK

Das Python SDK bietet eine einfache und sichere Integration des Lizenzsystems in Python-Anwendungen.

### Installation

```bash
pip install licensing-sdk
```

Oder aus dem Quellcode:

```bash
cd python-sdk
pip install -e .
```

### Grundlegende Verwendung

```python
from licensing_sdk import LicenseClient

# Client initialisieren
client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Lizenz aktivieren
result = client.activate()
if result['success']:
    print("✓ Lizenz aktiviert!")
    print(f"Token: {result['token']}")
else:
    print(f"✗ Aktivierung fehlgeschlagen: {result['message']}")

# Lizenz validieren (online)
if client.is_valid():
    print("✓ Lizenz ist gültig!")
    # Ihre Anwendungslogik hier
else:
    print("✗ Lizenz ist ungültig")
    exit(1)

# Offline-Validierung (bis zu 7 Tage)
if client.is_valid(online=False):
    print("✓ Lizenz ist offline gültig!")
```

### 2FA-Aktivierung

```python
from licensing_sdk import LicenseClientWith2FA

client = LicenseClientWith2FA(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Aktivierung initiieren
activation_result = client.initiate_activation()
if activation_result['success']:
    activation_token = activation_result['activationToken']
    print(f"Aktivierungstoken: {activation_token}")
    print("Bitte scannen Sie den QR-Code in Google Authenticator")
    
    # TOTP-Code vom Benutzer erhalten
    totp_code = input("Geben Sie den 6-stelligen Code ein: ")
    
    # Aktivierung mit 2FA bestätigen
    confirm_result = client.confirm_activation_with_2fa(
        activation_token=activation_token,
        totp_code=totp_code
    )
    
    if confirm_result['success']:
        print("✓ Lizenz erfolgreich mit 2FA aktiviert!")
    else:
        print(f"✗ 2FA-Bestätigung fehlgeschlagen: {confirm_result['message']}")
```

### Erweiterte Optionen

```python
# Benutzerdefinierte Geräte-ID
client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX",
    device_id="custom-device-id"  # Standard: Auto-generiert
)

# Offline-Token-Speicherung
client.save_token_offline()  # Speichert Token lokal
is_valid = client.is_valid(online=False)  # Verwendet gespeicherten Token

# Token-Informationen abrufen
token_info = client.get_token_info()
print(f"Ablaufdatum: {token_info['expiryDate']}")
print(f"Features: {token_info['features']}")
```

### Fehlerbehandlung

```python
from licensing_sdk import LicenseClient, LicenseError

try:
    client = LicenseClient(
        server_url="https://your-license-server.com",
        product_id=1,
        license_key="XXXX-XXXX-XXXX-XXXX"
    )
    
    result = client.activate()
    if not result['success']:
        print(f"Fehler: {result['message']}")
        
except LicenseError as e:
    print(f"Lizenzfehler: {e}")
except ConnectionError as e:
    print(f"Verbindungsfehler: {e}")
except Exception as e:
    print(f"Unerwarteter Fehler: {e}")
```

---

## 🎨 Admin-Portal

Das Admin-Portal bietet eine Verwaltungsoberfläche für das Lizenzsystem.

**Ausführliche Anleitung:** [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md)

### Zugriff

```
https://your-license-server.com
```

Melden Sie sich mit Manus OAuth an (oder nutzen Sie den lokalen Admin-Modus ohne OAuth).

### Navigation

| Bereich | Pfad |
|---|---|
| Dashboard | `/` |
| Products | `/products` |
| Licenses | `/licenses` |
| Customers | `/customers` |
| Activations | `/activations` |

### Dashboard

- Kennzahlen: Produkte, Lizenzen, Kunden, aktive Aktivierungen
- Letzte Aktivierungen und Lizenzstatus-Verteilung

### Produktverwaltung

- **Erstellen/Bearbeiten/Löschen** von Produkten
- **2FA:** Shield-Symbol → Setup, QR-Code, Enable/Disable

### Lizenzverwaltung

- **Erstellen** mit Typ, Max Activations, optionalem Ablaufdatum
- **Widerrufen** (Revoke)
- Lizenzschlüssel kopieren
- Status-/Metadata-Updates über API (UI: Erstellen + Widerrufen)

### Kundenverwaltung

- Kunden anlegen und auflisten

### Aktivierungsverlauf

- Alle Geräte-Aktivierungen mit Zeitstempel und Geräte-ID

---

## 🚀 Deployment

### Deployment auf Manus Platform

Das System ist bereits für die Manus Platform konfiguriert.

**Schritte:**
1. Erstellen Sie einen Checkpoint in der Manus UI
2. Klicken Sie auf **Publish**
3. Wählen Sie Ihre Domain
4. Das System wird automatisch deployed

### Deployment auf eigenen Servern

#### Voraussetzungen
- Node.js 18+
- MySQL 5.7+
- Nginx/Apache (optional, für Reverse Proxy)
- SSL-Zertifikat

#### Schritt 1: Repository klonen

```bash
git clone https://github.com/TheRealByteCommander/software-licensing-concept.git
cd software-licensing-concept
```

#### Schritt 2: Abhängigkeiten installieren

```bash
pnpm install
pnpm build
```

#### Schritt 3: Umgebungsvariablen setzen

Erstellen Sie eine `.env.local` im Projektroot (siehe README → Konfiguration).

#### Schritt 4: Datenbank initialisieren

```bash
pnpm db:push
```

#### Schritt 4: Produktions-Server starten

```bash
pnpm start
```

Der Server läuft dann auf Port 3000 (konfigurierbar via `PORT` Umgebungsvariable).

#### Schritt 5: Reverse Proxy konfigurieren (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Schritt 6: SSL mit Let's Encrypt

```bash
sudo certbot certonly --standalone -d your-domain.com
```

Aktualisieren Sie Ihre Nginx-Konfiguration für HTTPS.

#### Schritt 7: Systemd Service erstellen

```bash
sudo nano /etc/systemd/system/license-server.service
```

```ini
[Unit]
Description=Byte Commander License Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/www-data/license-server
ExecStart=/usr/bin/node /home/www-data/license-server/dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable license-server
sudo systemctl start license-server
```

---

## ⚙️ Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Beispiel |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL-Verbindungsstring | `mysql://user:pass@localhost:3306/db` |
| `JWT_SECRET` | Secret für JWT-Signing | `your-secret-key-min-32-chars` |
| `VITE_APP_ID` | Manus OAuth App-ID | `app-id-12345` |
| `OAUTH_SERVER_URL` | OAuth-Server URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | OAuth-Portal URL | `https://auth.manus.im` |
| `VITE_APP_TITLE` | Anwendungstitel | `Byte Commander License Server` |
| `VITE_APP_LOGO` | Logo-URL | `https://domain.com/logo.png` |
| `OWNER_NAME` | Besitzername | `Your Name` |
| `OWNER_OPEN_ID` | Besitzer OAuth ID | `owner-id-12345` |
| `PORT` | Server-Port | `3000` |
| `NODE_ENV` | Umgebung | `production` oder `development` |

### Datenbankschema

Das System verwendet folgende Tabellen:

- **users:** Benutzer und Admin-Konten
- **products:** Verwaltete Produkte
- **licenses:** Lizenzinformationen
- **activations:** Aktivierungsverlauf
- **customers:** Kundeninformationen
- **twoFASettings:** 2FA-Konfiguration pro Produkt
- **activationTokens:** Temporäre 2FA-Tokens

---

## 👨‍💻 Entwicklung

### Projektstruktur

```
software-licensing-concept/
├── client/                 # Frontend (React)
│   ├── src/
│   │   ├── pages/         # Seiten-Komponenten
│   │   ├── components/    # Wiederverwendbare Komponenten
│   │   ├── lib/           # Utilities
│   │   └── index.css      # Globale Styles
│   └── public/            # Statische Assets
├── server/                # Backend (Express + tRPC)
│   ├── routers.ts         # tRPC-Routers
│   ├── db.ts              # Datenbankfunktionen
│   ├── twoFARouter.ts     # 2FA-Endpoints
│   └── twoFAUtils.ts      # 2FA-Utilities
├── drizzle/               # Datenbankmigrationen
│   └── schema.ts          # Datenbankschema
├── python-sdk/            # Python SDK
│   ├── licensing_sdk/     # SDK-Code
│   ├── setup.py           # Setup-Konfiguration
│   └── README.md          # SDK-Dokumentation
└── todo.md                # Projekt-TODO

```

### Entwicklungsserver starten

```bash
pnpm dev
```

Dies startet:
- Frontend auf `http://localhost:5173`
- Backend auf `http://localhost:3000`

### Datenbank-Migrationen

Änderungen am Schema:

```bash
# Schema in drizzle/schema.ts bearbeiten
# Dann:
pnpm db:push
```

### Tests schreiben

```bash
pnpm test
```

### Code-Stil

Das Projekt verwendet:
- **ESLint:** Für JavaScript/TypeScript
- **Prettier:** Für Code-Formatierung
- **TypeScript:** Für Typ-Sicherheit

```bash
pnpm lint
pnpm format
```

---

## 🔒 Sicherheit

### Best Practices

1. **Umgebungsvariablen:** Speichern Sie niemals Secrets im Code
2. **HTTPS:** Verwenden Sie immer HTTPS in Produktion
3. **Rate Limiting:** Das System implementiert automatisches Rate Limiting
4. **Token-Ablauf:** Tokens haben ein Ablaufdatum
5. **Sichere Speicherung:** Passwörter werden gehashed

### Sicherheitsfeatures

- ✅ **JWT-Signatur:** Alle Tokens sind digital signiert
- ✅ **Token-Blacklisting:** Ungültige Tokens werden verwaltet
- ✅ **CORS:** Konfigurierbare Cross-Origin-Anfragen
- ✅ **SQL-Injection-Schutz:** Drizzle ORM schützt automatisch
- ✅ **XSS-Schutz:** React sanitiert automatisch
- ✅ **CSRF-Schutz:** Implementiert für Admin-Operationen

### Sicherheitsrichtlinien

1. **Regelmäßige Updates:** Halten Sie Abhängigkeiten aktuell
   ```bash
   pnpm update
   ```

2. **Sicherheits-Audits:** Führen Sie regelmäßig Audits durch
   ```bash
   pnpm audit
   ```

3. **Backup:** Sichern Sie Ihre Datenbank regelmäßig

4. **Monitoring:** Überwachen Sie Aktivitätslogs auf verdächtige Aktivitäten

---

## 🐛 Troubleshooting

### Häufige Probleme

#### 1. Datenbankverbindung fehlgeschlagen

**Fehler:** `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Lösung:**
```bash
# Überprüfen Sie die DATABASE_URL
echo $DATABASE_URL

# Stellen Sie sicher, dass MySQL läuft
sudo systemctl status mysql

# Testen Sie die Verbindung
mysql -u user -p -h localhost
```

#### 2. OAuth-Authentifizierung schlägt fehl

**Fehler:** `Invalid OAuth credentials`

**Lösung:**
```bash
# Überprüfen Sie die OAuth-Umgebungsvariablen
echo $VITE_APP_ID
echo $OAUTH_SERVER_URL

# Stellen Sie sicher, dass die App-ID korrekt ist
```

#### 3. 2FA-QR-Code wird nicht angezeigt

**Fehler:** `QR code generation failed`

**Lösung:**
```bash
# Überprüfen Sie, dass speakeasy installiert ist
npm list speakeasy

# Installieren Sie neu, falls nötig
pnpm install speakeasy
```

#### 4. Lizenzaktivierung schlägt fehl

**Fehler:** `Invalid license key`

**Lösung:**
```bash
# Überprüfen Sie die Lizenzschlüssel-Formatierung
# Format sollte sein: XXXX-XXXX-XXXX-XXXX

# Stellen Sie sicher, dass die Lizenz existiert
# Überprüfen Sie im Admin-Portal
```

#### 5. Python SDK-Verbindung fehlgeschlagen

**Fehler:** `ConnectionError: Failed to connect to server`

**Lösung:**
```python
# Überprüfen Sie die Server-URL
print(client.server_url)

# Stellen Sie sicher, dass der Server läuft
# curl https://your-license-server.com/api/health

# Überprüfen Sie die Firewall
```

### Logging

Aktivieren Sie Debug-Logging:

```bash
# Backend
DEBUG=* pnpm dev

# Python SDK
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Support

Für weitere Hilfe:
- 📧 Email: support@byte-commander.de
- 🐛 GitHub Issues: https://github.com/TheRealByteCommander/software-licensing-concept/issues
- 📚 Dokumentation: https://app.byte-commander.de/docs

---

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert. Siehe `LICENSE` für Details.

---

## 🤝 Beitragen

Beiträge sind willkommen! Bitte:

1. Forken Sie das Repository
2. Erstellen Sie einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committen Sie Ihre Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Pushen Sie zum Branch (`git push origin feature/AmazingFeature`)
5. Öffnen Sie einen Pull Request

---

## 📞 Kontakt

**Byte Commander**
- Website: https://app.byte-commander.de
- Email: info@byte-commander.de
- GitHub: https://github.com/TheRealByteCommander

---

## 🎉 Danksagungen

Dieses Projekt wurde mit modernen Technologien entwickelt:
- **Express.js** - Web-Framework
- **React 19** - Frontend-Framework
- **tRPC** - Type-safe RPC
- **Drizzle ORM** - Datenbankzugriff
- **Tailwind CSS** - Styling
- **Speakeasy** - TOTP-Generierung
- **Manus Platform** - Hosting und OAuth

---

**Letzte Aktualisierung:** März 2026  
**Version:** 1.0.0  
**Status:** Produktionsreif
