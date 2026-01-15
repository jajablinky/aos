type QueueStatusBarProps = {
  connectedLabel: string;
  mode: "normal" | "editor";
  activityLabel: string;
  activeLine: string | null;
  queue: string[];
};

export default function QueueStatusBar(props: QueueStatusBarProps) {
  const queuedPreview = props.queue.slice(0, 3);
  const remainingCount = Math.max(props.queue.length - queuedPreview.length, 0);

  return (
    <box
      flexShrink={0}
      border
      borderStyle="single"
      borderColor="#334155"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
    >
      <text
        content={`Connected: ${props.connectedLabel}`}
        style={{ fg: "#E2E8F0" }}
      />
      <text content={`Mode: ${props.mode}`} style={{ fg: "#A5B4FC" }} />
      <text
        content={`Activity: ${props.activityLabel}`}
        style={{ fg: "#94A3B8" }}
      />
      <text
        content={`Active: ${props.activeLine ?? "Idle"}`}
        style={{ fg: props.activeLine ? "#38BDF8" : "#94A3B8" }}
      />
      {queuedPreview.map((line) => (
        <text content={`Queued: ${line}`} style={{ fg: "#CBD5F5" }} />
      ))}

      {remainingCount > 0 ? (
        <text
          content={`+${remainingCount} more queued`}
          style={{ fg: "#94A3B8" }}
        />
      ) : null}
    </box>
  );
}
