import type { Tool } from '../src/types';

interface EchoToolArgs {
  message: string;
}

const echoTool: Tool<EchoToolArgs> = {
  name: 'echo',
  description: 'Echoes back the input message',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back'
      }
    },
    required: ['message']
  },
  run: async args => {
    return `Echo: ${args.message}`;
  }
};

export default echoTool;
