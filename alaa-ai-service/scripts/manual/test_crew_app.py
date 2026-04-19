import os
import asyncio
from crewai import Agent, Task, Crew, Process, LLM

async def main():
    os.environ["OLLAMA_API_BASE"] = "http://host.docker.internal:11434"
    llm = LLM(model="ollama/llama3", api_base="http://host.docker.internal:11434")

    agent = Agent(role='Tester', goal='say hi', backstory='agent', llm=llm, verbose=True)
    task = Task(description='hi', expected_output='hi', agent=agent)
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential)

    print("Kicking off...")
    res = crew.kickoff()
    print("Done:", res)

asyncio.run(main())
