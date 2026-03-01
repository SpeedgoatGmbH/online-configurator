"""
Query Gold Lake for I/O module lifecycle data.
Uses ActiveDirectoryInteractive auth — a browser login window will pop up.
"""

import pyodbc
import json
import sys

CONFIG = {
    "server": "kmmils5677oedelbwnxts5mueu-jxdjxy7ztaaepbh6kgd6apqqda.datawarehouse.fabric.microsoft.com",
    "database": "Data_Lake_Gold",
    "email": "daniel.hediger@speedgoat.ch",
}

def get_connection():
    conn_str = (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={CONFIG['server']};"
        f"Database={CONFIG['database']};"
        f"Authentication=ActiveDirectoryInteractive;"
        f"UID={CONFIG['email']};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    print("Connecting to Gold Lake (a browser window will open for login)...")
    return pyodbc.connect(conn_str)


def discover_tables(conn):
    """First, discover what tables/schemas exist to find article/product data."""
    cursor = conn.cursor()
    
    # List all tables
    cursor.execute("""
        SELECT TABLE_SCHEMA, TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    """)
    tables = cursor.fetchall()
    
    print(f"\n=== ALL TABLES ({len(tables)}) ===")
    for schema, table in tables:
        print(f"  {schema}.{table}")
    
    # Find tables likely containing article/product/IO module data
    print("\n=== LIKELY MODULE/ARTICLE TABLES ===")
    keywords = ['article', 'product', 'module', 'io', 'item', 'catalog', 'inventory', 'part']
    for schema, table in tables:
        name_lower = table.lower()
        if any(kw in name_lower for kw in keywords):
            print(f"  >> {schema}.{table}")
            # Show columns
            cursor.execute(f"""
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = '{schema}' AND TABLE_NAME = '{table}'
                ORDER BY ORDINAL_POSITION
            """)
            cols = cursor.fetchall()
            for col_name, col_type in cols[:20]:
                print(f"       {col_name} ({col_type})")
            if len(cols) > 20:
                print(f"       ... +{len(cols) - 20} more columns")
    
    return tables


def query_io_modules(conn, table_schema, table_name):
    """Query a specific table for IO module data with lifecycle/status info."""
    cursor = conn.cursor()
    
    # Get columns first
    cursor.execute(f"""
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{table_schema}' AND TABLE_NAME = '{table_name}'
    """)
    columns = [row[0] for row in cursor.fetchall()]
    
    # Look for status/lifecycle columns
    status_cols = [c for c in columns if any(kw in c.lower() for kw in ['status', 'lifecycle', 'active', 'obsolete', 'eol', 'discontinued', 'state'])]
    name_cols = [c for c in columns if any(kw in c.lower() for kw in ['name', 'description', 'title', 'friendlyname'])]
    id_cols = [c for c in columns if any(kw in c.lower() for kw in ['id', 'number', 'code', 'sku', 'articleno'])]
    
    print(f"\n  Status columns: {status_cols}")
    print(f"  Name columns: {name_cols}")
    print(f"  ID columns: {id_cols}")
    
    # Build a query with the most relevant columns
    select_cols = list(set(id_cols[:3] + name_cols[:3] + status_cols[:3]))
    if not select_cols:
        select_cols = columns[:8]
    
    col_str = ', '.join([f'[{c}]' for c in select_cols])
    
    # Query for IO modules (filter by name/number containing "IO")
    io_filter_cols = id_cols[:2] + name_cols[:2]
    if io_filter_cols:
        where_parts = [f"[{c}] LIKE '%IO%'" for c in io_filter_cols]
        where_clause = f"WHERE {' OR '.join(where_parts)}"
    else:
        where_clause = ""
    
    query = f"SELECT TOP 200 {col_str} FROM [{table_schema}].[{table_name}] {where_clause}"
    print(f"\n  Query: {query}")
    
    cursor.execute(query)
    rows = cursor.fetchall()
    col_names = [desc[0] for desc in cursor.description]
    
    print(f"\n  Results: {len(rows)} rows")
    results = []
    for row in rows:
        record = dict(zip(col_names, row))
        results.append(record)
        line = ' | '.join([f"{k}={v}" for k, v in record.items()])
        print(f"    {line}")
    
    return results


def main():
    conn = get_connection()
    print("Connected!")
    
    # Step 1: Discover tables
    tables = discover_tables(conn)
    
    # Step 2: Query tables that look like they contain article/product data
    keywords = ['article', 'product', 'module', 'item', 'catalog', 'part']
    for schema, table in tables:
        name_lower = table.lower()
        if any(kw in name_lower for kw in keywords):
            print(f"\n{'='*60}")
            print(f"  QUERYING: {schema}.{table}")
            print(f"{'='*60}")
            try:
                query_io_modules(conn, schema, table)
            except Exception as e:
                print(f"  ERROR: {e}")
    
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
