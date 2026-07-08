from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import access, admin, dashboard, org_graph, recommendations, request_packets, users

app = FastAPI(
    title=settings.app_name,
    description="Backend API for the Unified Access Onboarding Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(access.router, prefix="/api/access", tags=["Access"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["Recommendations"])
app.include_router(org_graph.router, prefix="/api/org-graph", tags=["Org Graph"])
app.include_router(request_packets.router, prefix="/api/request-packets", tags=["Request Packets"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/", tags=["Health"])
def root():
    return {"message": "Unified Access Onboarding Platform API", "version": "0.1.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
