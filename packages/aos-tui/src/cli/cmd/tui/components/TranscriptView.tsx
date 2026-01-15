import type { TranscriptEntry } from "../routes/session/types.js";

const kindColor: Record<TranscriptEntry["kind"], string> = {
  input: "#7DD3FC",
  output: "#E2E8F0",
  status: "#94A3B8",
};

type TranscriptViewProps = {
  entries: TranscriptEntry[];
};

export default function TranscriptView(props: TranscriptViewProps) {
  return (
    <scrollbox
      flexGrow={1}
      border
      borderStyle="single"
      borderColor="#334155"
      stickyScroll
      stickyStart="bottom"
      viewportCulling
    >
      <box
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        paddingBottom={1}
      >
        {props.entries.map((entry) => (
          <text content={entry.content} style={{ fg: kindColor[entry.kind] }} />
        ))}
      </box>
    </scrollbox>
  );
}
