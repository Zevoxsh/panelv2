export const createApiKeyBodySchema = {
  type: 'object',
  required: ['name', 'type'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    type: { type: 'string', enum: ['admin', 'user'] },
    expiresAt: { type: 'string', nullable: true },
  },
  additionalProperties: false,
} as const
