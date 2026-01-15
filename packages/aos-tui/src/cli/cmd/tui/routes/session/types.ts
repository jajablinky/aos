export type TranscriptEntry = {
  id: number;
  content: string;
  kind: "input" | "output" | "status";
};
