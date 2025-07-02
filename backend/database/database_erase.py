from database.database_connection import get_db_session


def clear_tables(entity_list: list):
    session = get_db_session()
    try:
        for entity in entity_list:
            session.query(entity).delete()
        session.commit()
        print("Companies and Jobs tables cleared.")
    except Exception as e:
        session.rollback()
        print(f"Error clearing tables: {e}")
    finally:
        session.close()


def main():
    from models import Company, Job, FetchCurl
    entities_to_clear = [Company, Job]

    print(
        "\nWARNING: This action will permanently erase ALL rows in the "
        f"following tables:\n  - {', '.join(e.__tablename__ for e in entities_to_clear)}"
    )
    input("Press Enter to proceed or press Ctrl+C to cancel...")

    clear_tables(entities_to_clear)


if __name__ == "__main__":
    main()
