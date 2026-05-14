export const createUserBodySchema = {
  type: 'object',
  required: ['username', 'email', 'password', 'role'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 50 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    role: { type: 'string', enum: ['admin', 'user'] },
  },
  additionalProperties: false,
} as const

export const updateUserBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 50 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    role: { type: 'string', enum: ['admin', 'user'] },
    isActive: { type: 'boolean' },
  },
  additionalProperties: false,
} as const
