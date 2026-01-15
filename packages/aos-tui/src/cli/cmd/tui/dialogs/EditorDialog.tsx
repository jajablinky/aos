import { createEffect } from "solid-js";

type EditorDialogProps = {
  visible: boolean;
  content: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function EditorDialog(props: EditorDialogProps) {
  let textareaRef: import("@opentui/core").TextareaRenderable | undefined;

  createEffect(() => {
    if (props.visible && textareaRef) {
      textareaRef.setText(props.content ?? "");
      textareaRef.focus();
    }
  });

  if (!props.visible) return null;

  return (
    <box
      position="absolute"
      top="10%"
      left="10%"
      width="80%"
      height="70%"
      border
      borderStyle="double"
      borderColor="#F97316"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor="#0F172A"
      zIndex={30}
    >
      <box flexDirection="column" width="100%" height="100%">
        <text content="Editor Mode" style={{ fg: "#FBBF24" }} />
        <textarea
          ref={textareaRef}
          initialValue={props.content}
          focused
          onContentChange={() => {
            if (textareaRef) {
              props.onChange(textareaRef.plainText ?? "");
            }
          }}
          onKeyDown={(event: import("@opentui/core").KeyEvent) => {
            if (event.name === "escape") {
              props.onCancel();
            }
            if (event.name === "return" && event.ctrl) {
              props.onSubmit();
            }
          }}
          style={{
            textColor: "#E2E8F0",
            focusedTextColor: "#F8FAFC",
            backgroundColor: "transparent",
            focusedBackgroundColor: "transparent",
            cursorColor: "#FBBF24",
          }}
          flexGrow={1}
        />
        <text
          content="Ctrl+Enter to submit · Esc to cancel"
          style={{ fg: "#94A3B8" }}
        />
      </box>
    </box>
  );
}
