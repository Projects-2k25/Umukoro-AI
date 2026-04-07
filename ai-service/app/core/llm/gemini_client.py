import json
import google.generativeai as genai
from app.config.settings import settings


def get_gemini_model():
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )


async def call_gemini_json(prompt: str, response_schema: dict = None) -> dict:
    model = get_gemini_model()
    response = model.generate_content(prompt)
    text = response.text.strip()

    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


async def call_gemini_text(prompt: str) -> str:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=0.4,
            max_output_tokens=4096,
        ),
    )
    response = model.generate_content(prompt)
    return response.text.strip()
