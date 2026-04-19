import os
from crewai import Agent, Task, Crew, Process, LLM

os.environ["OLLAMA_API_BASE"] = "http://host.docker.internal:11434"

llm = LLM(model="ollama/llama3", api_base="http://host.docker.internal:11434")

agent = Agent(
    role='Tester',
    goal='Say hi',
    backstory='You are a friendly agent.',
    llm=llm,
    verbose=True
)

task = Task(
    description='Say hello to the user',
    expected_output='A friendly greeting',
    agent=agent
)

crew = Crew(
    agents=[agent],
    tasks=[task],
    process=Process.sequential,
    verbose=True
)

print("Starting crew kickoff...")
try:
    result = crew.kickoff()
    print(f"Result: {result}")
except Exception as e:
    print(f"Failed: {e}")
