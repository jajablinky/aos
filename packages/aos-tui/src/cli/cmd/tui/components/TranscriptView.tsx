import type { ScrollBoxRenderable } from "@opentui/core";
import type { TranscriptEntry } from "../routes/session/types.js";

type Ref<T> = import("solid-js").Ref<T>;

const kindColor: Record<TranscriptEntry["kind"], string> = {
  input: "#7DD3FC",
  output: "#E2E8F0",
  status: "#94A3B8",
};

type TranscriptViewProps = {
  entries: TranscriptEntry[];
  scrollRef?: Ref<ScrollBoxRenderable>;
};

export default function TranscriptView(props: TranscriptViewProps) {
  return (
    <scrollbox ref={props.scrollRef} flexGrow={1}>
      <box flexDirection="column">
        {props.entries.map((entry) => (
          <text content={entry.content} style={{ fg: kindColor[entry.kind] }} />
        ))}
      </box>
    </scrollbox>
  );
}
