import os
from groq import Groq

# Initialize the Groq client. Requires GROQ_API_KEY environment variable.
# Fallback to a mock key for safe instantiation, but will fail on execution if invalid.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "mock-groq-key")

try:
    client = Groq(api_key=GROQ_API_KEY)
except Exception:
    client = None

def generate_telecom_response(prompt: str, model: str = "llama3-8b-8192") -> str:
    """
    Calls the cloud LLM to perform telecom reasoning (e.g., Root Cause Analysis).
    If no valid API key is present, it returns a mock deterministic response to ensure
    the application doesn't crash during hackathon development.
    """
    if not client or GROQ_API_KEY == "mock-groq-key":
        print("[WARNING] GROQ_API_KEY not found. Falling back to deterministic reasoning.")
        return _mock_fallback_response(prompt)

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert telecom network engineer and NOC AI agent. Analyze the provided logs, RAG context, and symptoms to predict the root cause. Return ONLY a JSON array of the top 3 causes with 'cause', 'confidence', and 'reasoning' keys."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=500
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"[ERROR] LLM Inference Failed: {e}")
        return _mock_fallback_response(prompt)

def _mock_fallback_response(prompt: str) -> str:
    """Fallback logic used when API is unavailable."""
    return '''[
        {"cause": "Faulty rectifier", "confidence": 92, "reasoning": "Symptom match + historical pattern."},
        {"cause": "Grid power failure", "confidence": 65, "reasoning": "Secondary possibility based on voltage drop."},
        {"cause": "Battery depletion", "confidence": 40, "reasoning": "Tertiary possibility."}
    ]'''
