class Quilt3AdminError(Exception):
    def __init__(self, details):
        super().__init__(details)
        self.details = details


class UserNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)


class BucketNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)


class RoleNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)


class RoleNameReservedError(Quilt3AdminError):
    pass


class RoleNameExistsError(Quilt3AdminError):
    pass


class RoleNameInvalidError(Quilt3AdminError):
    pass


class RoleTooManyPoliciesError(Quilt3AdminError):
    pass


class PolicyNotFoundError(Quilt3AdminError):
    def __init__(self):
        super().__init__(None)


class PolicyTitleExistsError(Quilt3AdminError):
    pass


class PolicyArnExistsError(Quilt3AdminError):
    pass


class InvalidInputError(Quilt3AdminError):
    pass


class OperationError(Quilt3AdminError):
    pass
