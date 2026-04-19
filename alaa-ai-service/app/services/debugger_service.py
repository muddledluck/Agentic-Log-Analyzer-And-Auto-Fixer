from app.core.llm_factory import apply_api_keys
from app.models.schemas import DiagnosisModel
from app.prompts.analysis_prompts import DEBUG_SYSTEM, build_debug_user_message
from app.services.litellm_chat import chat_completion
from app.services.utils import parse_json_object_from_text


def handle_debug(payload: dict, config: dict) -> dict:
    apply_api_keys(config.get("apiKeys", {}))

    messages = [
        {"role": "system", "content": DEBUG_SYSTEM},
        {
            "role": "user",
            "content": build_debug_user_message(payload["parsedError"]),
        },
    ]

    try:
        text = chat_completion(
            config["debuggerModel"],
            config.get("baseUrl"),
            messages,
        )
        data = parse_json_object_from_text(text)
        return DiagnosisModel.model_validate(data).model_dump()
    except Exception as e:
        fallback_model = config.get("fallbackModel")
        if not fallback_model:
            raise e

        print(
            f"Primary model {config['debuggerModel']} failed with {e!s}, "
            f"falling back to {fallback_model}..."
        )
        text = chat_completion(
            fallback_model,
            config.get("baseUrl"),
            messages,
        )
        data = parse_json_object_from_text(text)
        return DiagnosisModel.model_validate(data).model_dump()
