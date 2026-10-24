import { createClient } from '@supabase/supabase-js';
import { createMcpHandler } from '../server/connectorMcp.js';
export default createMcpHandler({ env: process.env, createClient });
