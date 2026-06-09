# PrivateFrame MVP-status

## Afgerond: Sprint 1

- Angular- en FastAPI-projecten bouwen reproduceerbaar.
- Centrale frontendconfiguratie voor development en productie.
- Angular bijgewerkt naar de gepatchte 21.x-lijn; de productie-audit bevat geen bekende kwetsbaarheden.
- PostgreSQL-schema beheerd via Alembic.
- Docker Compose bevat PostgreSQL, backend en Mailpit.
- De placeholder-assetresponse sluit aan op het frontendcontract.
- Backendtests, linting, migratiecontrole en frontendbuild draaien in GitHub Actions.
- Geslaagde pushes naar `main` kunnen release-based naar Hetzner deployen.
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

## Afgerond: Sprint 3

- Discovery sluit de ingelogde gebruiker uit en ondersteunt zoeken op naam, slug, bio, locatie en profielkenmerken.
- Profielen tonen nu ook leeftijdslabel, gender en recente activiteit.
- Er is een publiek profieldetailscherm op slug-niveau.
- De profielpagina toont recente profielbezoekers.
- Premiumgebruikers zien welke profielen hen bekeken; gratis accounts zien alleen anonieme meldingen.
- Backendtests dekken discoveryfilters en profielbezoekerslogica.

## Afgerond: Sprint 4

- Kaartjes ondersteunen echte media-upload via multipart in plaats van demo-assets.
- Uploads worden lokaal opgeslagen via `MEDIA_STORAGE_PATH` en via de API als preview/full asset geserveerd.
- Eigenaren zien hun eigen media volledig; gratis kijkers zien previews en premium ziet volledige assets.
- De itemspagina ondersteunt directe beeldupload en toont previews van geüploade bestanden.
- De profiel- en discoverypagina's zijn visueel bijgewerkt naar een donkerder thema dat beter aansluit op de rest van de app.
- Backendtests dekken upload, previewtoegang en premium/full-accessregels.

## Bestaande platformbasis

- Profielen, unieke slugs, discovery en profielbezoekersregistratie.
- Posts met toestemmingsbevestigingen en premium locking.
- Premium chat-API.
- Reports, adminacties en auditlog.
- Mock premiumplan.
- Offline API-documentatie en healthcheck.

## Volgende productstappen

1. Chatfrontend bouwen.
2. Moderatie- en adminfrontend bouwen.
3. Echte abonnementsbetalingen integreren.
4. Productie-hardening, privacy en compliance uitvoeren.
