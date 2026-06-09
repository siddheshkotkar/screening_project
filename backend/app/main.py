import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.feeds import router as feeds_router
from app.routes.auth import router as auth_router
from app.config import settings

app = FastAPI(
    title="Screening Automator API",
    description="Backend API for managing feed-to-keyword mappings and GitLab comparison.",
    version="1.0.0"
)

# Configure CORS so our React frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(feeds_router, tags=["Feeds"])
app.include_router(auth_router, tags=["Auth"])

@app.get("/")
def read_root():
    return {
        "app": "Screening Automator API",
        "status": "healthy",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
