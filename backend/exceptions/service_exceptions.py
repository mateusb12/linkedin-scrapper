class ServiceException(Exception):
    """Base exception for service layer errors."""
    pass

class LinkedInScrapingException(ServiceException):
    """Raised when a LinkedIn scraping operation fails."""
    pass