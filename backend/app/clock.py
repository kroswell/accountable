from datetime import date, datetime


def now() -> datetime:
    return datetime.now().astimezone().replace(tzinfo=None)


def today() -> date:
    return now().date()
