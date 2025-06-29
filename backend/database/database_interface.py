# database/database_interface.py

from abc import ABC, abstractmethod


class DatabaseInterface(ABC):
    """
    An abstract base class that defines the required methods
    for any database handler in the application.
    """

    @abstractmethod
    def connect(self):
        """Establishes a connection to the database."""
        pass

    @abstractmethod
    def disconnect(self):
        """Closes the connection to the database."""
        pass

    @abstractmethod
    def execute_query(self, query: str, params: tuple = None) -> list:
        """
        Executes a given query.

        Args:
            query (str): The query string to execute.
            params (tuple, optional): The parameters for the query. Defaults to None.

        Returns:
            list: The result of the query.
        """
        pass
