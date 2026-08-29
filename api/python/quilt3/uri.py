"""Logical Quilt package URI parsing."""

from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from .util import QuiltException


class PackageUriError(QuiltException):
    """Raised when a logical Quilt package URI is malformed."""

    def __init__(self, message: str, uri: str):
        super().__init__(f"Invalid package URI ({uri}): {message}", uri=uri, detail=message)


@dataclass(frozen=True)
class PackageUri:
    """A logical package, revision, and optional path in an S3 registry."""

    bucket: str
    name: str
    path: str | None = None
    hash: str | None = None
    tag: str | None = None
    catalog: str | None = None

    @property
    def registry(self) -> str:
        return f"s3://{self.bucket}"

    @classmethod
    def parse(cls, uri: str) -> "PackageUri":
        try:
            parsed = urlsplit(uri)
        except ValueError as ex:
            raise PackageUriError(str(ex), uri) from ex

        protocol = f"{parsed.scheme}:" if parsed.scheme else ""
        if parsed.scheme != "quilt+s3":
            raise PackageUriError(
                f'unsupported protocol "{protocol}". "quilt+s3:" is currently the only supported protocol.',
                uri,
            )
        # URI schemes are case-insensitive and `urlsplit` normalizes them, so test the
        # separator against the raw string by offset rather than matching a lowercase
        # prefix -- otherwise "QUILT+S3://..." reads as though it had no slashes.
        if not uri[len(parsed.scheme) + 1 :].startswith("//"):
            raise PackageUriError("missing slashes between protocol and registry.", uri)
        if parsed.path or parsed.query:
            raise PackageUriError("non-bucket-root registries are not supported currently.", uri)

        # `parse_qs` reads the fragment as a form query, taking a raw "+" to mean a
        # space. Producers emit unencoded paths (quilt_uri.py builds
        # `&path=${logicalKey}` verbatim), so "C++.csv" would silently become
        # "C  .csv" -- pointing at another entry. Escaping it keeps it literal;
        # `encodeURIComponent` escapes "+", so well-formed URIs are unaffected. A
        # stray "%" needs no such help: `unquote` already leaves it alone.
        fragment = parsed.fragment.replace("+", "%2B")
        try:
            params = parse_qs(fragment, keep_blank_values=True, errors="strict")
        except UnicodeDecodeError as ex:
            # A well-formed escape whose bytes are not valid UTF-8, e.g. "%FF". The
            # default errors="replace" would substitute U+FFFD, yielding a path that
            # cannot match any entry; the catalog rejects these too.
            raise PackageUriError("malformed percent-encoding.", uri) from ex
        package_values = params.get("package")
        if package_values and len(package_values) > 1:
            raise PackageUriError('"package=" specified multiple times.', uri)
        if not package_values or not package_values[0]:
            raise PackageUriError('missing "package=" part.', uri)
        if not parsed.netloc:
            raise PackageUriError("missing bucket.", uri)

        path = cls._single_optional_param(params, "path", uri)
        catalog = cls._single_optional_param(params, "catalog", uri)
        name, tag, hash_value = cls._parse_package_spec(package_values[0], uri)
        return cls(
            bucket=parsed.netloc,
            name=name,
            # `parse_qs` has already percent-decoded these; decoding a second time
            # would mangle a literal "%20" and reject a literal "%".
            path=path,
            hash=hash_value,
            tag=tag,
            catalog=catalog,
        )

    @staticmethod
    def _single_optional_param(params: dict[str, list[str]], name: str, uri: str) -> str | None:
        values = params.get(name)
        if not values:
            return None
        if len(values) > 1:
            raise PackageUriError(f'"{name}=" specified multiple times.', uri)
        return values[0] or None

    @staticmethod
    def _parse_package_spec(spec: str, uri: str) -> tuple[str, str | None, str | None]:
        if ":" in spec and "@" in spec:
            raise PackageUriError('"package=" part may either contain ":" or "@".', uri)
        if ":" in spec:
            parts = spec.split(":")
            if not parts[0]:
                raise PackageUriError('"package=" part must contain non-empty package name.', uri)
            if len(parts) > 2:
                raise PackageUriError('"package=" part may contain only one ":".', uri)
            if not parts[1]:
                raise PackageUriError('"package=" part: tag must not be empty.', uri)
            return parts[0], parts[1], None
        if "@" in spec:
            parts = spec.split("@")
            if not parts[0]:
                raise PackageUriError('"package=" part must contain non-empty package name.', uri)
            if len(parts) > 2:
                raise PackageUriError('"package=" part may contain only one "@".', uri)
            if not parts[1]:
                raise PackageUriError('"package=" part: hash must not be empty.', uri)
            return parts[0], None, parts[1]
        return spec, None, None


def is_package_uri(value: object) -> bool:
    """Return whether a value should be parsed as a logical Quilt package URI."""

    # URI schemes are case-insensitive, so route "QUILT+S3://..." as a URI too rather
    # than letting it fall through to legacy package-name handling.
    return isinstance(value, str) and value.lower().startswith("quilt+")
