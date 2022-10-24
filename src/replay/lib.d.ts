export type Command = {
  name: string;
  args: any[];
};

export type Replay = {
  commands: Command[];
};
