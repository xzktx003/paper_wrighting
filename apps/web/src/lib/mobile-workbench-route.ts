export interface MobileWorkbenchLocation {
  hash: string;
  pathname: string;
  search: string;
}

export function isMobileWorkbenchLocation({
  hash,
  pathname,
  search,
}: MobileWorkbenchLocation): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/mobile" || normalizedPath === "/m") {
    return true;
  }

  const params = new URLSearchParams(search);
  if (params.get("view") === "mobile" || params.get("mobile") === "1") {
    return true;
  }

  const normalizedHash = hash.replace(/^#\/?/, "").replace(/\/+$/, "");
  return normalizedHash === "mobile" || normalizedHash === "m";
}
