# PrivateFrame

PrivateFrame is een Nederlandse private social discovery-MVP met accounts, e-mailverificatie, profielen,
uitgebreide discovery, profielbezoekers, contentkaartjes, echte media-uploads, premiumtoegang en een backendbasis
voor chat en moderatie.

## Stack

- Angular 21
- FastAPI
- SQLModel en PostgreSQL 16
- Alembic-databasemigraties
- Mailpit voor lokale e-mail
- GitHub Actions voor linting, tests, migratiecontrole en builds

## Lokaal starten met Docker

```bash
docker compose up --build
```

Daarna zijn de diensten beschikbaar op:

- Frontend: start apart via `npm start` op <http://localhost:4200>
- Backend: <http://localhost:8000>
- API-documentatie: <http://localhost:8000/docs>
- Mailpit-inbox: <http://localhost:8025>

De backend voert bij het starten automatisch `alembic upgrade head` uit.

Een databasevolume uit de oude, pre-Alembic MVP heeft nog geen migratiehistorie. Voor die uitsluitend lokale
ontwikkeldata is een eenmalige schone start nodig met `docker compose down -v`, gevolgd door
`docker compose up --build`. Gebruik dit niet op een database waarvan de inhoud bewaard moet blijven.

## Frontend lokaal starten

```bash
cd frontend
npm install
npm start
```

De developmentconfiguratie gebruikt `http://127.0.0.1:8000/api/v1`. Een productiebuild gebruikt het relatieve
pad `/api/v1`.

## Backend zonder Docker starten

Zorg dat PostgreSQL draait en maak vanuit `backend/` een `.env` op basis van `.env.example`.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e . --group dev
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

Met `EMAIL_BACKEND=console` worden verificatie- en resetlinks in de backendlog geschreven. Met Docker gaan ze
naar Mailpit.

## Kwaliteitscontroles

```bash
cd backend
.venv/bin/ruff check app migrations tests
.venv/bin/pytest --cov=app
.venv/bin/alembic check

cd ../frontend
npm run build
```

## Automatische productie-deployment

Iedere push of merge naar `main` wordt na geslaagde backend- en frontendcontroles automatisch naar de
Hetzner-server gedeployed. PrivateFrame blijft bereikbaar via:

```text
http://77.42.77.241:8080
```

De GitHub-repository heeft hiervoor één Actions-secret nodig:

```text
DEPLOY_SSH_KEY
```

Dit secret bevat de private SSH-deploykey waarvan de publieke sleutel op de server is geïnstalleerd. De workflow
bouwt de frontend in GitHub Actions, maakt een release op de server, back-upt PostgreSQL, voert Alembic uit,
herstart de systemd-service en controleert de healthcheck. Bij een mislukte healthcheck worden de applicatiebestanden
naar de vorige release teruggezet.

De productieomgeving staat in `/etc/privateframe/backend.env` op de server en wordt niet in Git opgeslagen.

## Accountflow

1. Registreer met een wachtwoord van minimaal 10 tekens.
2. Log in en open de verificatiemail.
3. Bevestig het e-mailadres.
4. Rond de eenvoudige leeftijdsbevestiging af.
5. Gebruik profielen, discovery, posts en het accountplan.

## Discovery en profielen

- Discovery ondersteunt zoeken op naam, slug, bio en locatie.
- Discovery toont leeftijdslabel, gender en recente activiteit wanneer die beschikbaar zijn.
- Ieder profiel heeft een publiek slugscherm onder `/discover/:slug`.
- De profielpagina toont recente profielbezoeken.
- Gratis accounts zien profielbezoeken anoniem; premium ziet ook welk profiel heeft gekeken.

## Media-uploads

- Kaartjes ondersteunen image-upload via de frontend voor `jpg`, `png`, `webp` en `gif`.
- Uploads tot 10 MB worden lokaal opgeslagen onder `MEDIA_STORAGE_PATH`.
- De API serveert altijd een preview-URL; volledige media is zichtbaar voor de eigenaar en voor premiumaccounts.

Sessies zijn zeven dagen geldig, kunnen met logout worden ingetrokken en worden allemaal ingetrokken na een
wachtwoordreset. Login-, registratie- en herstelendpoints hebben basis-rate-limiting.

## Nog niet productieklaar

- Leeftijdscontrole is nog een eenvoudige bevestiging.
- Betalingen zijn nog gemockt.
- De rate limiter is procesgebonden; productie vraagt een gedeelde opslag zoals Redis.
- Chat, reports en adminfuncties bestaan als API maar hebben nog geen volledige frontend.
- Voor productie zijn onder meer echte e-mailbezorging, secrets, monitoring en formeel privacy- en
  moderatiebeleid nodig.
