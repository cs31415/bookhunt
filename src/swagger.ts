import path from 'path';
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
  // Resolved from this module rather than the working directory, so the spec is
  // built the same way however the process was started. A cwd-relative
  // './src/controllers/**/*.ts' silently produced an *empty* spec in a container:
  // the image ships only dist/, so the glob matched nothing and /api/docs
  // rendered zero endpoints without erroring.
  //
  // Both extensions because __dirname is src/ under tsx in dev and dist/ once
  // built — and the JSDoc comments survive tsc, so the compiled .js carries the
  // same annotations.
  apis: [path.join(__dirname, 'controllers/**/*.ts'), path.join(__dirname, 'controllers/**/*.js')],
};

export const swaggerSpec = swaggerJsdoc(options);
