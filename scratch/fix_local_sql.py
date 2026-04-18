import pyodbc
import os

def fix_local_sql():
    # Attempt to connect to local SQL Server using Windows Authentication
    # We use both driver version to be sure
    drivers = [d for d in pyodbc.drivers() if 'SQL Server' in d]
    print(f"Available drivers: {drivers}")
    
    connected = False
    for driver in drivers:
        try:
            conn_str = f'DRIVER={{{driver}}};SERVER=127.0.0.1;DATABASE=master;Trusted_Connection=yes;'
            print(f"Trying connection with: {driver}")
            conn = pyodbc.connect(conn_str, autocommit=True, timeout=5)
            print(f"Successfully connected to local SQL Server via {driver}")
            cursor = conn.cursor()
            
            print("Enabling 'sa' login and setting password...")
            cursor.execute("ALTER LOGIN [sa] ENABLE")
            cursor.execute("ALTER LOGIN [sa] WITH PASSWORD = N'Antigravity2026!'")
            
            # Also ensure SQL Authentication is enabled (Mixed Mode)
            # This requires a registry change and a restart, which we might not be able to do easily.
            # But let's at least try the login.
            
            print("Creating 'antigravity' login as backup...")
            cursor.execute("IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'antigravity') CREATE LOGIN [antigravity] WITH PASSWORD = N'Antigravity2026!', CHECK_POLICY = OFF")
            cursor.execute("ALTER SERVER ROLE [sysadmin] ADD MEMBER [antigravity]")
            
            print("Checking Authentication Mode...")
            cursor.execute("SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')")
            mode = cursor.fetchone()[0]
            if mode == 1:
                print("WARNING: SQL Server is in Windows Auth ONLY mode. sa login will NOT work until Mixed Mode is enabled and service restarted.")
            else:
                print("SUCCESS: SQL Server is in Mixed Mode.")
            
            conn.close()
            connected = True
            break
        except Exception as e:
            print(f"Failed with {driver}: {e}")

    if not connected:
        print("COULD NOT CONNECT TO ANY LOCAL SQL SERVER")

if __name__ == "__main__":
    fix_local_sql()
