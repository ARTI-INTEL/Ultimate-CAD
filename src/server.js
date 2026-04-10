import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes    from './routes/users.routes.js';
import serverRoutes  from './routes/servers.routes.js';
import officerRoutes from './routes/officers.routes.js';
import callRoutes    from './routes/calls.routes.js';
import boloRoutes    from './routes/bolos.routes.js';
import reportRoutes  from './routes/reports.routes.js';
import searchRoutes  from './routes/search.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/users',    userRoutes);
app.use('/servers',  serverRoutes);
app.use('/officers', officerRoutes);
app.use('/calls',    callRoutes);
app.use('/bolos',    boloRoutes);
app.use('/reports',  reportRoutes);
app.use('/search',   searchRoutes);

app.listen(PORT, () => {
  console.log(`Ultimate CAD server running on http://localhost:${PORT}`);
});