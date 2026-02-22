import os
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from main import create_llm, handle_parse, handle_debug

app = FastAPI(title="ALAA CrewAI Service")

#
# Pydantic Models for Web Requests
#

class ConfigModel(BaseModel):
    model: str
    baseUrl: str

class ParsePayload(BaseModel):
    rawBlock: str
    contextLines: List[str]

class ParseRequest(BaseModel):
    payload: ParsePayload
    config: ConfigModel

class DebugPayload(BaseModel):
    parsedError: Dict[str, Any]

class DebugRequest(BaseModel):
    payload: DebugPayload
    config: ConfigModel

class AgentResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

#
# Endpoints
#

@app.post("/api/parse", response_model=AgentResponse)
async def api_parse(request: ParseRequest):
    try:
        llm = create_llm(request.config.model_dump())
        data = handle_parse(request.payload.model_dump(), llm)
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))

@app.post("/api/debug", response_model=AgentResponse)
async def api_debug(request: DebugRequest):
    try:
        llm = create_llm(request.config.model_dump())
        data = handle_debug(request.payload.model_dump(), llm)
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
