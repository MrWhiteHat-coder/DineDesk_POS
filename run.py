#!/usr/bin/env python3
"""
FoodFlow POS — Local development server.
For production, use: uvicorn backend.server:app --host 0.0.0.0 --port 8000
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
