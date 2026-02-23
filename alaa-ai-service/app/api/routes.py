from fastapi import APIRouter
from app.models.schemas import ParseRequest, DebugRequest, AgentResponse
from app.services.parser_service import handle_parse
from app.services.debugger_service import handle_debug

router = APIRouter()

@router.post("/parse", response_model=AgentResponse)
async def api_parse(request: ParseRequest):
    try:
        data = handle_parse(request.payload.model_dump(), request.config.model_dump())
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))

@router.post("/debug", response_model=AgentResponse)
async def api_debug(request: DebugRequest):
    try:
        data = handle_debug(request.payload.model_dump(), request.config.model_dump())
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))
