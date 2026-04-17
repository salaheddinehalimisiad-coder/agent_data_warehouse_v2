import os
import sys
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()
google_key = os.getenv("GOOGLE_API_KEY")

models = [
    "models/gemini-1.5-flash",
    "models/gemini-pro"
]

for model in models:
    print(f"Testing {model}...")
    try:
        llm = ChatGoogleGenerativeAI(model=model, google_api_key=google_key)
        resp = llm.invoke("Hi")
        print(f"SUCCESS {model}")
    except Exception as e:
        print(f"FAILED {model}: {e}")
