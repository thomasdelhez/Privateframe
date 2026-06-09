# PrivateFrame MVP-status

## Afgerond: Sprint 1

- Angular- en FastAPI-projecten bouwen reproduceerbaar.
- Centrale frontendconfiguratie voor development en productie.
- Angular bijgewerkt naar de gepatchte 21.x-lijn; de productie-audit bevat geen bekende kwetsbaarheden.
- PostgreSQL-schema beheerd via Alembic.
- Docker Compose bevat PostgreSQL, backend en Mailpit.
- De placeholder-assetresponse sluit aan op het frontendcontract.
- Backendtests, linting, migratiecontrole en frontendbuild draaien in GitHub Actions.
- Lokale start- en testdocumentatie is bijgewerkt.

## Afgerond: Sprint 2

- Registratie met minimaal 10 tekens voor wachtwoorden.
- Intrekbare databasesessies met een geldigheid van zeven dagen.
- Server-side logout.
- Verplichte e-mailverificatie vóór profiel, discovery en overige beschermde flows.
- Verificatielinks verlopen na 24 uur en zijn eenmalig.
- Verificatielink opnieuw aanvragen.
- Wachtwoord vergeten en resetten met een eenmalige link van 60 minuten.
- Alle sessies worden ingetrokken na een wachtwoordreset.
- Route guards voor login, verificatie en leeftijdsbevestiging.
- Neutrale antwoorden bij herstelverzoeken om accountenumeratie te beperken.
- Basis-rate-limiting op gevoelige accountendpoints.
- Duidelijkere validatie- en API-foutmeldingen in de frontend.

## Bestaande platformbasis

- Profielen, unieke slugs, discovery en profielbezoekersregistratie.
- Posts met toestemmingsbevestigingen en premium locking.
- Premium chat-API.
- Reports, adminacties en auditlog.
- Mock premiumplan.
- Offline API-documentatie en healthcheck.

## Volgende productstappen

1. Profielen en discovery uitbreiden.
2. Echte media-upload en opslag toevoegen.
3. Chatfrontend bouwen.
4. Moderatie- en adminfrontend bouwen.
5. Echte abonnementsbetalingen integreren.
6. Productie-hardening, privacy en compliance uitvoeren.
