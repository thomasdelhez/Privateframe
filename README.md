# PrivateFrame

PrivateFrame is een private social discovery platform met gratis previews, premium toegang, premium chat en profielbezoekers als premium feature.

## MVP-uitgangspunten

- Nederlands/EU gericht.
- Angular frontend.
- FastAPI backend.
- PostgreSQL database.
- Eigen JWT-auth.
- Simpele leeftijdsbevestiging voor de eerste prototypeversie.
- Gebruikers kunnen zelf foto-posts plaatsen.
- Gratis gebruikers zien beperkte previews.
- Premium gebruikers zien volledige content, kunnen chatten en zien profielbezoekers.
- Betalingen zijn in de MVP gemockt via een mock billing provider.
- Moderatie gebeurt achteraf via reports en admin-acties.

## Repositorystructuur

```text
backend/   FastAPI backend
frontend/  Angular frontend skeleton
docs/      product- en technische documentatie
```

## Lokaal starten

### Backend + database

```bash
docker compose up --build
```

De backend draait standaard op:

```text
http://localhost:8000
```

Swagger/OpenAPI:

```text
http://localhost:8000/docs
```

### Frontend

De frontend is als Angular-projectstructuur voorbereid. Installeer lokaal:

```bash
cd frontend
npm install
npm start
```

## Productienotitie

De huidige MVP gebruikt een simpele leeftijdsbevestigingsknop. Voor een publieke productievariant moet dit worden uitgebreid met passende verificatie, formele voorwaarden, privacybeleid, moderatieprocessen en een geschikte betaalprovider.
