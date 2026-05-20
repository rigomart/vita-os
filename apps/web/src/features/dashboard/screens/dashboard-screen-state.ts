interface ShouldShowAreaSetupArgs {
  areaCount: number;
  attentionThreadCount: number;
}

export function shouldShowAreaSetup({
  areaCount,
  attentionThreadCount,
}: ShouldShowAreaSetupArgs) {
  return areaCount === 0 && attentionThreadCount === 0;
}
