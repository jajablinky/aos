type CommandPaletteProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
};

const commands = [
  {
    name: ".editor",
    description: "Open multiline editor",
    value: ".editor",
  },
  {
    name: ".load",
    description: "Load a Lua file",
    value: ".load ",
  },
  {
    name: ".load-blueprint",
    description: "Load blueprint by name",
    value: ".load-blueprint ",
  },
  {
    name: ".exit",
    description: "Exit the session",
    value: ".exit",
  },
];

export default function CommandPalette(props: CommandPaletteProps) {
  if (!props.visible) return null;

  return (
    <box
      position="absolute"
      top="20%"
      left="20%"
      width="60%"
      height={12}
      border
      borderStyle="double"
      borderColor="#38BDF8"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor="#000000"
      zIndex={20}
    >
      <box flexDirection="column" width="100%" height="100%">
        <text content="Command Palette" style={{ fg: "#E2E8F0" }} />
        <select
          options={commands}
          showDescription
          focused
          height={8}
          backgroundColor="transparent"
          focusedBackgroundColor="transparent"
          selectedBackgroundColor="#1E293B"
          textColor="#CBD5F5"
          selectedTextColor="#38BDF8"
          descriptionColor="#94A3B8"
          selectedDescriptionColor="#CBD5F5"
          onSelect={(index: number, option: { value?: string } | null) => {
            void index;
            if (option?.value) {
              props.onSelect(option.value as string);
            }
            props.onClose();
          }}
        />
        <text
          content="Enter to select, Esc to close"
          style={{ fg: "#94A3B8" }}
        />
      </box>
    </box>
  );
}
