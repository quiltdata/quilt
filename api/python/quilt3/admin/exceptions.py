class Quilt3AdminError(Exception):
    def __init__(self, details):
        super().__init__(details)
        self.details = details


class UserNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)
