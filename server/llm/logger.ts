type LogLevel = "info" | "warn" | "error";

export function llmLog(level: LogLevel, event: string, data: Record<string, any>) {
  const payload = {
    ts: new Date().toISOString(),
    src: "llm-gateway",
    level,
    event,
    ...data,
  };
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}
