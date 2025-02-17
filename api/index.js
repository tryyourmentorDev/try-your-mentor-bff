import serverless from 'serverless-http';
import app from '../src/app.js';  // path to your Express "app.js"

export default serverless(app);
