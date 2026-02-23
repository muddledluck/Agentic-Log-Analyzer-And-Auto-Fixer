from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# ─── Core Domain Models (CrewAI outputs) ──────────────────────

class StackFrameModel(BaseModel):
    """A single stack frame from an error trace."""
    file: str = Field(description="File path referenced in the stack trace")
    line: Optional[int] = Field(default=None, description="Line number")
    functionName: str = Field(description="Function or method name")
    code: Optional[str] = Field(default=None, description="Code snippet at that line")

class ParsedErrorModel(BaseModel):
    """Structured output from the Parser Agent."""
    errorType: str = Field(description='Error class name, e.g. "ECONNREFUSED"')
    errorMessage: str = Field(description="Human-readable error message")
    stackFrames: List[StackFrameModel] = Field(default_factory=list, description="Parsed stack frames")
    contextLines: List[str] = Field(default_factory=list, description="Cleaned context lines")
    severity: str = Field(description='One of: "critical", "high", "medium", "low"')

class SuggestedFixModel(BaseModel):
    """A proposed code fix."""
    language: str = Field(description="Programming language of the fix")
    filePath: Optional[str] = Field(default=None, description="File that needs the fix")
    original: Optional[str] = Field(default=None, description="Original problematic code")
    fixed: str = Field(description="The corrected code")
    description: str = Field(description="What the fix does")

class DiagnosisModel(BaseModel):
    """Structured output from the Debugger Agent."""
    rootCause: str = Field(description="Brief one-line root cause")
    explanation: str = Field(description="Detailed explanation (2-4 sentences)")
    suggestedFix: SuggestedFixModel = Field(description="Proposed code fix")
    severity: str = Field(description='One of: "critical", "high", "medium", "low"')
    confidence: int = Field(description="Confidence score 0-100")
    additionalNotes: List[str] = Field(default_factory=list, description="Extra recommendations")

# ─── API Request/Response Models ──────────────────────────────

class ApiKeysModel(BaseModel):
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    gemini: Optional[str] = None

class ConfigModel(BaseModel):
    parserModel: str
    debuggerModel: str
    fallbackModel: Optional[str] = None
    baseUrl: Optional[str] = None
    apiKeys: ApiKeysModel

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
