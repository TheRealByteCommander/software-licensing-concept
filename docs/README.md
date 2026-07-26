# Dokumentation – Byte Commander License Server

## Anleitungen (Start hier)

| Zielgruppe | Dokument | Inhalt |
|---|---|---|
| **Lizenz-Administrator** | [ANLEITUNG_LIZENZADMIN.md](./ANLEITUNG_LIZENZADMIN.md) | Produkte, Lizenzen, 2FA, Kunden, Aktivierungen |
| **Software-Nutzer (Endanwender)** | [ANLEITUNG_SOFTWARENUTZER.md](./ANLEITUNG_SOFTWARENUTZER.md) | Lizenzschlüssel aktivieren, 2FA, Fehlerbehebung |
| **Entwickler / Integration** | [../INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) | SDK-Einbindung (Python, Node, .NET) |
| **Webhooks** | Admin-Portal `/webhooks` + [ANLEITUNG_LIZENZADMIN.md](./ANLEITUNG_LIZENZADMIN.md#9-webhooks-externe-integration) | Outbound Event-Benachrichtigungen |
| **Stripe Billing** | Admin-Portal `/billing`, Checkout `/checkout` + [ANLEITUNG_LIZENZADMIN.md](./ANLEITUNG_LIZENZADMIN.md#8-stripe-zahlungen) | Stripe Checkout → automatische Lizenzvergabe |

## Technische Referenz

| Dokument | Inhalt |
|---|---|
| [../README.md](../README.md) | Projektüberblick, Architektur, Entwicklung |
| [../API_DOCUMENTATION.md](../API_DOCUMENTATION.md) | API-Endpunkte und Fehlercodes |
| [../api/openapi.v1.yaml](../api/openapi.v1.yaml) | Versionierter API-Vertrag (v1) |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Produktions-Deployment |
| [../python-sdk/README.md](../python-sdk/README.md) | Python SDK |
| [../python-sdk/README_2FA.md](../python-sdk/README_2FA.md) | Python SDK – 2FA-Flow |
| [../sdk/typescript/README.md](../sdk/typescript/README.md) | TypeScript SDK |
| [../sdk/dotnet/README.md](../sdk/dotnet/README.md) | .NET SDK |
