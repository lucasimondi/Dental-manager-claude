import {handler} from '../server.mjs';
const serve=handler();
export default function(req,res){const u=req.url||'';req.url=u.includes('oauth-protected-resource')?'/'+u.replace(/^\//,'').replace(/^api\//,''):req.method==='GET'&&u.includes('health')?'/health':'/mcp';return serve(req,res)}
