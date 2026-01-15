type PromptInputProps = {
  value: string;
  focused: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  inputRef?: import("solid-js").Ref<import("@opentui/core").InputRenderable>;
};

export default function PromptInput(props: PromptInputProps) {
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
    >
      <input
        ref={props.inputRef}
        value={props.value}
        placeholder="Send a command to aos"
        focused={props.focused}
        onInput={props.onChange}
        onSubmit={props.onSubmit}
        style={{
          textColor: "#E2E8F0",
          focusedTextColor: "#F8FAFC",
          backgroundColor: "transparent",
          focusedBackgroundColor: "transparent",
          placeholderColor: "#64748B",
          cursorColor: "#38BDF8",
        }}
      />
    </box>
  );
}
