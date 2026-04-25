"""Structured JSON logging setup."""
import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        # Include extra fields if present
        for key, value in record.__dict__.items():
            if key in data or key in (
                "args", "msg", "levelno", "pathname", "filename", "module",
                "exc_text", "stack_info", "lineno", "funcName", "created",
                "msecs", "relativeCreated", "thread", "threadName", "processName",
                "process", "levelname", "name",
            ):
                continue
            try:
                json.dumps(value)
                data[key] = value
            except TypeError:
                data[key] = str(value)
        return json.dumps(data, ensure_ascii=False)


def configure() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    for noisy in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
