import os
import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection():
    # A new connection to the Supabase database; rows come back as dicts (row["password"])
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)