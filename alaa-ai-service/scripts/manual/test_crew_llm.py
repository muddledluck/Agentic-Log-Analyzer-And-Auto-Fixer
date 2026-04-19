from crewai import LLM
import os

print("Testing CrewAI LLM connection to Ollama...")

try:
    llm = LLM(model='ollama/llama3', base_url='http://host.docker.internal:11434')
    # Use litellm explicitly if llm doesn't have a direct ping
    # Let's see what base_url it holds
    print(f"LLM base URL: {getattr(llm, 'base_url', 'Not found')}")
    print(f"LLM kwargs dict: {llm.__dict__}")
except Exception as e:
    print(f"Error initializing: {e}")

