import os
from litellm import completion

os.environ["OLLAMA_API_BASE"] = "http://host.docker.internal:11434"
print(f"OLLAMA_API_BASE={os.environ['OLLAMA_API_BASE']}")

try:
    res = completion(model="ollama/llama3", messages=[{"role": "user", "content": "hello"}])
    print(res)
except Exception as e:
    print(f"Error: {e}")
