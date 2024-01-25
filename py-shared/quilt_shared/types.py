import pydantic


class NonEmptyStr(pydantic.ConstrainedStr):
    min_length = 1
    strip_whitespace = True
