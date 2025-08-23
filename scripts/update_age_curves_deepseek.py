#!/usr/bin/env python3
"""
Update age_curves table with DeepSeek methodology values
"""
import psycopg2
import os

# DeepSeek Age Curve Reference Table
AGE_CURVES = {
    'RB': {
        21: 0.95, 22: 1.00, 23: 1.05, 24: 1.03, 25: 1.00,
        26: 0.98, 27: 0.95, 28: 0.90, 29: 0.85, 30: 0.75
    },
    'WR': {
        21: 0.90, 22: 0.95, 23: 1.00, 24: 1.03, 25: 1.05,
        26: 1.05, 27: 1.03, 28: 1.00, 29: 0.98, 30: 0.90
    },
    'TE': {
        21: 0.85, 22: 0.90, 23: 0.95, 24: 1.00, 25: 1.03,
        26: 1.05, 27: 1.05, 28: 1.03, 29: 1.00, 30: 0.95
    },
    'QB': {
        21: 0.90, 22: 0.95, 23: 1.00, 24: 1.03, 25: 1.05,
        26: 1.05, 27: 1.05, 28: 1.05, 29: 1.03, 30: 1.00
    }
}

def main():
    print("🔄 Updating age_curves table with DeepSeek methodology...")
    
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        
        # Clear existing age curves
        cur.execute("DELETE FROM age_curves;")
        print(f"✅ Cleared existing age curves")
        
        # Insert DeepSeek age curves
        inserted = 0
        for position, ages in AGE_CURVES.items():
            for age, multiplier in ages.items():
                cur.execute(
                    "INSERT INTO age_curves (position, age, multiplier) VALUES (%s, %s, %s);",
                    [position, age, multiplier]
                )
                inserted += 1
                
                # Add 30+ curve for older players
                if age == 30:
                    for older_age in range(31, 40):
                        cur.execute(
                            "INSERT INTO age_curves (position, age, multiplier) VALUES (%s, %s, %s);",
                            [position, older_age, multiplier]
                        )
                        inserted += 1
        
        conn.commit()
        print(f"✅ Inserted {inserted} age curve records")
        
        # Verify the update
        cur.execute("SELECT position, COUNT(*) FROM age_curves GROUP BY position ORDER BY position;")
        results = cur.fetchall()
        print("\n📊 Age curves by position:")
        for position, count in results:
            print(f"  {position}: {count} age entries")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error updating age curves: {e}")
        return False
        
    return True

if __name__ == '__main__':
    success = main()
    if success:
        print("\n🎯 Age curves updated successfully with DeepSeek methodology!")
    else:
        print("\n💥 Failed to update age curves")