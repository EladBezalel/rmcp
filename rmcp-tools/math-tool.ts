import { Tool } from '../src';

const mathTool: Tool<{ a: number; b: number }> = {
  name: 'add',
  description: 'Adds two numbers together',
  inputSchema: {
    type: 'object',
    properties: {
      a: {
        type: 'number',
        description: 'First number'
      },
      b: {
        type: 'number',
        description: 'Second number'
      }
    },
    required: ['a', 'b']
  },
  run: async (args): Promise<string> => {
    const result = args.a + args.b;
    return `${args.a} + ${args.b} = ${result}`;
  }
};

export default mathTool;
