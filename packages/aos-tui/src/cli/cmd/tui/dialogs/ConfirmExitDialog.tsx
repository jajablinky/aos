type ConfirmExitDialogProps = {
  visible: boolean;
};

export default function ConfirmExitDialog(props: ConfirmExitDialogProps) {
  if (!props.visible) return null;

  return (
    <box
      position="absolute"
      top="35%"
      left="30%"
      width="40%"
      height={6}
      border
      borderStyle="single"
      borderColor="#F87171"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor="#0F172A"
      zIndex={30}
    >
      <box flexDirection="column" width="100%" height="100%">
        <text content="Exit session?" style={{ fg: "#F87171" }} />
        <text
          content="Press Enter to confirm, Esc to cancel"
          style={{ fg: "#E2E8F0" }}
        />
      </box>
    </box>
  );
}
