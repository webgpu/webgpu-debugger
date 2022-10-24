export type CommandArgs = Record<string, any>;

export type Command = {
  name: string;
  args: CommandArgs;
};

export type Replay = {
  commands: Command[];
};

export type CommandBuffer = {
  commands: Command[];
};

export type QueueSubmitArgs = {
  commandBuffers: CommandBuffer[];
};

