export function bindPublishingControls(
  root: HTMLElement,
  rules: {
    timeBounds(id: string): { min: string; max: string };
    timeValid(id: string, value: string): boolean;
  },
): () => void;
