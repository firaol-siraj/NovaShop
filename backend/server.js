import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import connectDB from './src/config/db.js';

import "./src/workers/emailWorker.js"; 

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start Express server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[NovaShop Server]: Running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});