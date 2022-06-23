import * as PackageUri from "./PackageUri";

export function stringify(packageHandle: PackageUri.PackageUri): string {
  return PackageUri.stringify(packageHandle).replace("quilt+s3", "teleport");
}
