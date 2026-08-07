import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookHunt API',
      version: '1.0.0',
      description: 'Personal book explorer API — search, library, AI summaries, and recommendations.',
    },
    servers: [
      { url: '/api', description: 'API base path' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        CannedSearch: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            query: { type: 'string', example: 'history that reads like a thriller' },
            category: { type: 'string', nullable: true, example: 'era-and-place' },
          },
        },
      },
    },
  },
  apis: ['./src/controllers/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
