from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.billing.router import router as billing_router
from app.chat.router import router as chat_router
from app.core.config import get_settings
from app.posts.router import router as posts_router
from app.profiles.router import router as profiles_router
from app.reports.router import router as reports_router

settings = get_settings()
app = FastAPI(title=settings.app_name, docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(profiles_router, prefix=settings.api_prefix)
app.include_router(posts_router, prefix=settings.api_prefix)
app.include_router(billing_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(reports_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)


@app.get("/docs", include_in_schema=False)
def offline_docs() -> HTMLResponse:
    schema = app.openapi()
    rows = []
    for path, methods in sorted(schema.get("paths", {}).items()):
        for method, operation in sorted(methods.items()):
            if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                continue
            summary = operation.get("summary") or operation.get("operationId") or ""
            tags = ", ".join(operation.get("tags", []))
            rows.append(
                f"<tr><td><code>{method.upper()}</code></td><td><code>{path}</code></td><td>{tags}</td><td>{summary}</td></tr>"
            )

    html = f"""
    <!doctype html>
    <html lang="nl">
      <head>
        <meta charset="utf-8" />
        <title>{settings.app_name} API docs</title>
        <style>
          body {{ font-family: Arial, sans-serif; margin: 2rem; background: #111827; color: #f9fafb; }}
          a {{ color: #93c5fd; }}
          table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; }}
          th, td {{ border-bottom: 1px solid #374151; padding: .75rem; text-align: left; vertical-align: top; }}
          th {{ color: #f472b6; }}
          code {{ background: #1f2937; padding: .15rem .35rem; border-radius: .35rem; }}
          .card {{ background: #1f2937; padding: 1rem; border-radius: .75rem; margin-bottom: 1rem; }}
        </style>
      </head>
      <body>
        <h1>{settings.app_name} API docs</h1>
        <div class="card">
          <p>Offline documentatie zonder externe Swagger assets.</p>
          <p>OpenAPI JSON: <a href="/openapi.json">/openapi.json</a></p>
          <p>Healthcheck: <a href="/health">/health</a></p>
        </div>
        <table>
          <thead><tr><th>Methode</th><th>Pad</th><th>Tag</th><th>Omschrijving</th></tr></thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
      </body>
    </html>
    """
    return HTMLResponse(html)
