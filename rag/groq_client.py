import os
from groq import Groq


def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        from pathlib import Path
        env_file = Path(__file__).resolve().parent.parent / ".env"
        if env_file.exists():
            with env_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("GROQ_API_KEY"):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        os.environ["GROQ_API_KEY"] = api_key
                        break

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY environment variable is not set."
        )

    return Groq(api_key=api_key)


def generate_answer(prompt):
    """Generate an answer from Groq LLM given a fully-formed prompt string."""
    client = get_groq_client()

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0,
        max_tokens=1024,
    )

    return response.choices[0].message.content
