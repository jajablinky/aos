type HelpDialogProps = {
  visible: boolean;
};

export default function HelpDialog(props: HelpDialogProps) {
  if (!props.visible) return null;

  return (
    <box
      position="absolute"
      top="15%"
      left="15%"
      width="70%"
      height={10}
      border
      borderStyle="single"
      borderColor="#22C55E"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor="#000000"
      zIndex={20}
    >
      <box flexDirection="column" width="100%" height="100%">
        <text content="Help" style={{ fg: "#86EFAC" }} />
        <text content="Ctrl+P: Command palette" style={{ fg: "#E2E8F0" }} />
        <text content="Ctrl+E: Editor mode" style={{ fg: "#E2E8F0" }} />
        <text content="Ctrl+D: Send EOF" style={{ fg: "#E2E8F0" }} />
        <text content="Ctrl+C: Exit" style={{ fg: "#E2E8F0" }} />
        <text content="Esc: Close dialogs" style={{ fg: "#94A3B8" }} />
      </box>
    </box>
  );
}
