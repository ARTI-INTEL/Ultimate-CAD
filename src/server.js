import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes         from './routes/auth.routes.js';
import robloxRoutes       from './jobs/robloxManager.js';
import userRoutes         from './routes/users.routes.js';
import serverRoutes       from './routes/servers.routes.js';
import unitRoutes         from './routes/units.routes.js';
import callRoutes         from './routes/calls.routes.js';
import boloRoutes         from './routes/bolos.routes.js';
import reportRoutes       from './routes/reports.routes.js';
import searchRoutes       from './routes/search.routes.js';
import characterRoutes    from './routes/characters.routes.js';
import vehicleRoutes      from './routes/vehicles.routes.js';
import firearmRoutes      from './routes/firearms.routes.js';
import verificationRoutes from './routes/verification.routes.js';
import erlcRoutes         from './jobs/erlcPoller.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/auth',          authRoutes);
app.use('/auth/roblox',   robloxRoutes);
app.use('/users',         userRoutes);
app.use('/servers',       serverRoutes);
app.use('/units',         unitRoutes);
app.use('/calls',         callRoutes);
app.use('/bolos',         boloRoutes);
app.use('/reports',       reportRoutes);
app.use('/search',        searchRoutes);
app.use('/characters',    characterRoutes);
app.use('/vehicles',      vehicleRoutes);
app.use('/firearms',      firearmRoutes);
app.use('/verification',  verificationRoutes);
app.use('/erlc',          erlcRoutes);

app.listen(PORT, () => {
  console.log(`Ultimate CAD server running on http://localhost:${PORT}`);
});