import json
import anthropic
from app.config.settings import settings


def get_claude_client():
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


async def call_claude_json(prompt: str, response_schema: dict = None) -> dict:
    client = get_claude_client()
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=8192,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text.strip()

    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


async def call_claude_text(prompt: str) -> str:
    client = get_claude_client()
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        temperature=0.4,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
