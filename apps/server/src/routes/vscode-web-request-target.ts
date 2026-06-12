function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function firstForwardedValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function parseHeaderHost(value: string | string[] | undefined): string | null {
  const rawValue = firstForwardedValue(firstHeaderValue(value));
  if (!rawValue) {
    return null;
  }

  if (/[\u0000-\u001f\u007f\s/\\?#@]/u.test(rawValue)) {
    return null;
  }

  try {
    const parsed = new URL(`http://${rawValue}`);
    if (
      !parsed.host ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed.host;
  } catch {
    return null;
  }
}

function parseHeaderUrl(
  value: string | string[] | undefined,
): { host: string } | null {
  const rawValue = firstForwardedValue(firstHeaderValue(value));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);
    return {
      host: parsed.host,
    };
  } catch {
    return null;
  }
}

export function resolveVsCodeWebRequestTarget(request: {
  headers: Record<string, string | string[] | undefined>;
  protocol: string;
}): { requestHost?: string; requestProtocol: "http" } {
  const forwardedHost = parseHeaderHost(request.headers["x-forwarded-host"]);
  if (forwardedHost) {
    return {
      requestHost: forwardedHost,
      requestProtocol: "http",
    };
  }

  const browserOrigin =
    parseHeaderUrl(request.headers.origin) ??
    parseHeaderUrl(request.headers.referer);
  if (browserOrigin) {
    return {
      requestHost: browserOrigin.host,
      requestProtocol: "http",
    };
  }

  return {
    requestHost: parseHeaderHost(request.headers.host) ?? undefined,
    requestProtocol: "http",
  };
}
