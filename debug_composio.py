"""
debug_composio.py — Diagnostic de l'API Composio v2
"""
import os
import sys
import traceback
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("COMPOSIO_API_KEY", "").strip()
print(f"API Key: {api_key[:8]}...")

try:
    from composio import Composio
    print("Import Composio OK")
    
    client = Composio(api_key=api_key)
    print("Client créé OK")
    
    print("\nAttributs du client:", [a for a in dir(client) if not a.startswith("_")])
    
    print("\nTest client.tools ...")
    print("Attributs tools:", [a for a in dir(client.tools) if not a.startswith("_")])
    
    # get() signature - let's try without user_id first
    print("\nEssai client.tools.get(toolkits=['FILETOOL'])...")
    try:
        result = client.tools.get(toolkits=["FILETOOL"])
        print(f"OK: {type(result)}, {len(result) if result else 0} outils")
    except TypeError as e:
        print(f"TypeError: {e}")
        # Try with user_id
        print("\nEssai avec user_id='default'...")
        result = client.tools.get(user_id="default", toolkits=["FILETOOL"])
        print(f"OK: {type(result)}, {len(result) if result else 0} outils")
    
except Exception as e:
    print(f"ERREUR : {e}")
    traceback.print_exc()
