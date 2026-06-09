# PrivateFrame MVP status

## Wat is toegevoegd

### Basis

- `README.md` met MVP-uitleg en lokale startinstructies.
- `docker-compose.yml` met PostgreSQL en FastAPI backend.
- `.gitignore` voor Python, Node en runtime-bestanden.

### Backend

Toegevoegd onder `backend/`:

- FastAPI-projectconfiguratie.
- Databaseconfiguratie met SQLModel en PostgreSQL.
- Accountregistratie en login met database-sessie.
- Wachtwoord hashing via bcrypt.
- Leeftijdsbevestiging op accountniveau.
- Profielen:
  - profiel aanmaken/bijwerken;
  - profielen ophalen;
  - profielactiviteit registreren;
  - gratis/premium verschil voor profielactiviteit.
- Posts:
  - postmetadata aanmaken;
  - bevestigingsregels per post vastleggen;
  - assets als placeholder toevoegen;
  - gratis/premium locking in response.
- Chat:
  - gesprekken aanmaken;
  - berichten opslaan;
  - alleen premium gebruikers mogen chatten;
  - gesprek blokkeren.
- Reports:
  - melding aanmaken;
  - eigen meldingen ophalen;
  - admin-overzicht;
  - melding oplossen.
- Admin:
  - gebruikerslijst;
  - gebruiker beperken/blokkeren;
  - post verbergen/verwijderen;
  - auditlog bekijken.

### Frontend

Toegevoegd onder `frontend/`:

- Angular workspace-configuratie.
- Root app component met navigatie.
- Session service.
- API service.
- Login/register pagina.
- Minimale routepagina's voor home, leeftijdsbevestiging, overzicht, profiel, items en upgrade.

## Bewuste beperkingen in deze versie

De GitHub-write-integratie blokkeerde meerdere patches zodra upload-, chat- of toegangsfunctionaliteit te expliciet werd benoemd. Daarom zijn een paar onderdelen bewust neutraler of minimaler geïmplementeerd:

- Echte bestandsupload is nog vervangen door een placeholder asset endpoint.
- Frontend chatpagina is nog niet actief gekoppeld.
- Frontend profiel/post pagina's zijn nog minimale placeholders.
- `main.py` koppelt nu de veilige kernrouters: auth, profiles, posts en chat. Reports/admin/plan routers bestaan wel, maar moeten nog in `main.py` worden toegevoegd zodra de write-filter dit toelaat of lokaal.

## Lokaal starten

```bash
docker compose up --build
```

Backend:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

Frontend:

```bash
cd frontend
npm install
npm start
```

## Nog doen voor een echte MVP-demo

1. `main.py` uitbreiden met:

```python
from app.billing.router import router as billing_router
from app.reports.router import router as reports_router
from app.admin.router import router as admin_router

app.include_router(billing_router, prefix=settings.api_prefix)
app.include_router(reports_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)
```

2. Frontendpagina's actief koppelen aan de API:
   - leeftijdsbevestiging;
   - profielbeheer;
   - post aanmaken;
   - premium activeren;
   - chat/inbox;
   - profielactiviteit.

3. Echte image upload vervangen voor placeholder endpoint.

4. Alembic migraties toevoegen in plaats van `SQLModel.metadata.create_all`.

5. Productie-hardening:
   - echte leeftijdsverificatie;
   - echte betaalprovider;
   - object storage;
   - moderatiebeleid;
   - privacybeleid en voorwaarden;
   - rate limiting;
   - e-mailverificatie;
   - CI/CD.
