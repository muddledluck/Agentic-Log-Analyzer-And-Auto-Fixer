from app.core.llm_factory import apply_api_keys
from app.models.schemas import ParsedErrorModel
from app.prompts.analysis_prompts import PARSE_SYSTEM, build_parse_user_message
from app.services.litellm_chat import chat_completion
from app.services.utils import parse_json_object_from_text


def handle_parse(payload: dict, config: dict) -> dict:
    apply_api_keys(config.get("apiKeys", {}))

    messages = [
        {"role": "system", "content": PARSE_SYSTEM},
        {
            "role": "user",
            "content": build_parse_user_message(
                payload["rawBlock"], payload.get("contextLines") or []
            ),
        },
    ]
    text = chat_completion(
        config["parserModel"],
        config.get("baseUrl"),
        messages,
    )
    data = parse_json_object_from_text(text)
    return ParsedErrorModel.model_validate(data).model_dump()
