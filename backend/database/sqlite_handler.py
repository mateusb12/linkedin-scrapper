# database/sqlite_handler.py

import sqlite3
from .database_interface import DatabaseInterface


class SQLiteHandler(DatabaseInterface):
    """
    A concrete implementation of the DatabaseInterface for SQLite.
    """

    def __init__(self, db_name: str):
        self.db_name = db_name
        self.connection = None

    def connect(self):
        """Establishes and returns a connection to the SQLite database."""
        try:
            self.connection = sqlite3.connect(self.db_name)
            print("Successfully connected to SQLite.")
            return self.connection
        except sqlite3.Error as e:
            print(f"Error connecting to SQLite database: {e}")
            return None

    def disconnect(self):
        """Closes the database connection."""
        if self.connection:
            self.connection.close()
            print("SQLite connection closed.")

    def execute_query(self, query: str, params: tuple = None) -> list:
        """
        Executes a query on the SQLite database.

        This method uses a context manager ('with') to ensure the
        connection is handled safely and transactions are committed.
        """
        if not self.connection:
            self.connect()

        try:
            with self.connection as conn:
                cursor = conn.cursor()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)

                # For statements that modify data, commit is implicit with 'with'.
                # For SELECT statements, we fetch the results.
                result = cursor.fetchall()
                return result
        except sqlite3.Error as e:
            print(f"Error executing query: {e}")
            return []

