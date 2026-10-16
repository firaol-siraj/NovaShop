import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NovaShop E-Commerce API',
      version: '1.0.0',
      description: 'Production REST API with Express, JWT Auth, Redis Caching, and BullMQ Background Queues',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Scans all route files for JSDoc @openapi annotations
};

export const swaggerSpec = swaggerJSDoc(options);