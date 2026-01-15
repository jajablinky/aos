const ansiPattern = new RegExp("\u001b\\[[0-9;]*m", "g");

export const stripAnsi = (value: string): string =>
  value.replace(ansiPattern, "");
