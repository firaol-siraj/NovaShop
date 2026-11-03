import './src/config/env.js';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { verifyTransporter } from './src/services/emailService.js';
import { cancelExpiredUnpaidOrders } from './src/controllers/orderController.js';
import { initDashboardIndexesAndSettings } from './src/migrations/initDashboardIndexesAndSettings.js';
import { seedRealisticSupportConversations } from './src/migrations/seedSupportConversations.js';
import { startSupportEmailWorker, stopSupportEmailWorker } from './src/workers/supportEmailWorker.js';

import "./src/workers/emailWorker.js";

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, verify email transporter, then start Express server
connectDB().then(async () => {
  // Initialize dashboard indexes and default settings
  await initDashboardIndexesAndSettings().catch((err) => {
    console.error('[Dashboard Migration Error]:', err.message);
  });

  // Seed realistic support conversations if none exist
  await seedRealisticSupportConversations().catch((err) => {
    console.error('[Support Seed Error]:', err.message);
  });

  // Verify SMTP Transporter without blocking server start if network is slow
  verifyTransporter().catch((err) => {
    console.error('[EmailService Verification Error]:', err.message);
  });

  const server = app.listen(PORT, () => {
    console.log(`[NovaShop Server]: Running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Periodically cancel expired unpaid orders and release stock (every 5 minutes)
  const orderCleanupInterval = setInterval(() => {
    cancelExpiredUnpaidOrders().catch((err) => {
      console.error('[OrderCleanup Error]:', err.message);
    });
  }, 5 * 60 * 1000);

  // Trigger initial check on boot
  cancelExpiredUnpaidOrders().catch(() => {});

  // Start Inbound Support Email IMAP polling worker (polls every 60s)
  startSupportEmailWorker(60000);

  const handleShutdown = () => {
    clearInterval(orderCleanupInterval);
    stopSupportEmailWorker();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[NovaShop Server Error]: Port ${PORT} is already in use. Please terminate the conflicting process or set PORT.`);
    } else {
      console.error('[NovaShop Server Error]:', err.message);
    }
  });
});
