import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

def test_conn():
    print("Testing connections...")
    
    # Try 1: sa with .env password
    pwd = os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST", "127.0.0.1")
    user = os.getenv("DB_USER", "sa")
    
    conn_str_sa = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={host},1433;DATABASE=master;"
        f"UID={user};PWD={pwd};TrustServerCertificate=yes;"
    )
    
    try:
        print(f"Attempting sa login to {host}...")
        conn = pyodbc.connect(conn_str_sa, timeout=5)
        print("✅ SUCCESS: sa login works!")
        conn.close()
        return
    except Exception as e:
        print(f"❌ FAILED: sa login: {e}")

    # Try 2: Trusted Connection (Windows Auth)
    conn_str_trusted = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={host},1433;DATABASE=master;"
        f"Trusted_Connection=yes;TrustServerCertificate=yes;"
    )

    try:
        print(f"Attempting Trusted Connection to {host}...")
        conn = pyodbc.connect(conn_str_trusted, timeout=5)
        print("✅ SUCCESS: Trusted Connection (Windows Auth) works!")
        conn.close()
    except Exception as e:
        print(f"❌ FAILED: Trusted Connection: {e}")

if __name__ == "__main__":
    test_conn()
