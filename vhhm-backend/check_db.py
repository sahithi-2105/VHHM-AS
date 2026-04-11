import sqlite3
import json

def check_db():
    try:
        conn = sqlite3.connect('vhhm.db')
        c = conn.cursor()
        
        print("--- Users ---")
        c.execute("SELECT id, username, email, role, name FROM users")
        users = c.fetchall()
        for u in users:
            print(u)
            
        print("\n--- Health Logs ---")
        c.execute("SELECT * FROM health_logs")
        logs = c.fetchall()
        for l in logs:
            print(l)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
