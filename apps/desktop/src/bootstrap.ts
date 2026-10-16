export type DiagnosticStage = 1 | 2 | 3;

export function diagnosticStage(search: string): DiagnosticStage | undefined {
  const value = new URLSearchParams(search).get("transparency-test");
  return value === "1" || value === "2" || value === "3"
    ? (Number(value) as DiagnosticStage)
    : undefined;
}

export async function bootstrap({
  search,
  launchMode,
  loadTerminal,
  loadDiagnostic,
}: {
  search: string;
  launchMode(): Promise<string>;
  loadTerminal(): Promise<void>;
  loadDiagnostic(stage: DiagnosticStage): Promise<void>;
}) {
  const mode = await launchMode();
  const stage = diagnosticStage(search);
  if (mode === "transparency-test" || stage) await loadDiagnostic(stage ?? 1);
  else await loadTerminal();
}
