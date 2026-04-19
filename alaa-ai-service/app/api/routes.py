from fastapi import APIRouter
from app.models.schemas import ParseRequest, DebugRequest, AgentResponse, AnalyzeRequest
from app.services.parser_service import handle_parse
from app.services.debugger_service import handle_debug
import json

router = APIRouter()

@router.post("/parse", response_model=AgentResponse)
async def api_parse(request: ParseRequest):
    try:
        import os
        if request.config.baseUrl:
            os.environ["OLLAMA_API_BASE"] = request.config.baseUrl
        data = handle_parse(request.payload.model_dump(), request.config.model_dump())
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))

@router.post("/debug", response_model=AgentResponse)
async def api_debug(request: DebugRequest):
    try:
        import os
        if request.config.baseUrl:
            os.environ["OLLAMA_API_BASE"] = request.config.baseUrl
        data = handle_debug(request.payload.model_dump(), request.config.model_dump())
        return AgentResponse(success=True, data=data)
    except Exception as e:
        return AgentResponse(success=False, error=str(e))

@router.post("/analyze")
async def api_analyze(request: AnalyzeRequest):
    try:
        # 1. Parse Phase
        import os
        if request.config.baseUrl:
            os.environ["OLLAMA_API_BASE"] = request.config.baseUrl
            
        parse_payload = {
            "rawBlock": request.payload.raw_message,
            "contextLines": request.payload.context
        }
        parsed_data = handle_parse(parse_payload, request.config.model_dump())
        
        # 2. Debug Phase
        debug_payload = {
            "parsedError": parsed_data
        }
        debug_data = handle_debug(debug_payload, request.config.model_dump())
        
        # 3. Format as Markdown Report
        report = f"## AI Root Cause Analysis\n\n"
        report += f"**Error Type:** {parsed_data.get('errorType', 'Unknown')}\n\n"
        report += f"**Root Cause:** {debug_data.get('rootCause', 'Not identified')}\n\n"
        report += f"### Explanation\n{debug_data.get('explanation', '')}\n\n"
        
        fix = debug_data.get('suggestedFix', {})
        if fix:
            report += f"### Suggested Fix\n"
            report += f"{fix.get('description', '')}\n\n"
            report += f"```{(fix.get('language') or 'text').lower()}\n"
            report += f"{fix.get('fixed', '')}\n"
            report += f"```\n"

        return {"report": report}
    except Exception as e:
        return {"report": f"## AI Analysis Failed\n\nAn error occurred while analyzing this event: {str(e)}"}
