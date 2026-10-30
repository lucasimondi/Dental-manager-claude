import { createServer } from "node:http";

const URL_BASE = process.env.POLIEDRON_SUPABASE_URL;
const API_KEY = process.env.POLIEDRON_SUPABASE_PUBLISHABLE_KEY;
const fields = "id,titolo,fascicolo,tipo_documento,persona,categoria,ente,drive_url,pratica_id";

function respond(res,status,data) {
  res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});
  res.end(JSON.stringify(data));
}
function rpc(id,result) { return {jsonrpc:"2.0",id,result}; }
const tools = [
  {name:"search_documents",description:"Cerca metadati documenti personali, esclusi documenti clinici.",inputSchema:{type:"object",properties:{query:{type:"string"},fascicolo:{type:"string"},limit:{type:"integer"}},required:["query"]}},
  {name:"get_document",description:"Recupera i metadati di un documento personale.",inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"]}}
];
async function request(path,token,body) {
  const r = await fetch(new URL(path,URL_BASE),{method:body?"POST":"GET",headers:{apikey:API_KEY,authorization:"Bearer "+token,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok) throw Error("Supabase access denied");
  return r.json();
}
async function toolCall(name,args,token) {
  if(name==="search_documents") {
    const q=String(args.query||"").slice(0,200);
    const fasc=args.fascicolo?String(args.fascicolo).slice(0,50):null;
    const lim=Math.min(30,Math.max(1,Number(args.limit)||10));
    const data=await request("/rest/v1/rpc/cerca_documenti",token,{q,fasc,lim});
    return (Array.isArray(data)?data:[]).filter(x=>x.fascicolo!=="clinico_pazienti").map(x=>Object.fromEntries(fields.split(",").map(k=>[k,x[k]??null])));
  }
  if(name==="get_document") {
    const id=String(args.id||"");
    if(!/^[a-f0-9-]{36}$/i.test(id)) throw Error("Invalid id");
    const data=await request("/rest/v1/documenti?select="+encodeURIComponent(fields)+"&id=eq."+id+"&fascicolo=neq.clinico_pazienti&limit=1",token);
    return data[0]||null;
  }
  throw Error("Unknown tool");
}
export function handler() {
  return async (req,res)=>{
    if(req.method==="GET"&&req.url==="/health") return respond(res,200,{status:"ok",mode:"read-only"});
    if(req.method!=="POST"||req.url!=="/mcp") return respond(res,404,{error:"not_found"});
    if(!URL_BASE||!API_KEY) return respond(res,503,{error:"not_configured"});
    const token=/^Bearer (.+)$/.exec(req.headers.authorization||"")?.[1];
    if(!token) return respond(res,401,{error:"unauthorized"});
    try {const user=await request("/auth/v1/user",token);if(!user.id)throw Error("Unauthorized");}
    catch {return respond(res,401,{error:"unauthorized"});}
    let raw="";
    for await (const chunk of req) {raw+=chunk;if(raw.length>65536)return respond(res,413,{error:"too_large"});}
    let msg;try{msg=JSON.parse(raw);}catch{return respond(res,400,{error:"invalid_json"});}
    if(msg.method==="initialize") return respond(res,200,rpc(msg.id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"poliedron-personal",version:"0.1.0"}}));
    if(msg.method==="tools/list")return respond(res,200,rpc(msg.id,{tools}));
    if(msg.method==="notifications/initialized")return respond(res,202,{});
    if(msg.method==="tools/call"){
      try {
        if(!tools.some(x=>x.name===msg.params?.name))throw Error("Unknown tool");
        const value=await toolCall(msg.params.name,msg.params.arguments||{},token);
        return respond(res,200,rpc(msg.id,{content:[{type:"text",text:JSON.stringify(value)}]}));
      }catch{return respond(res,200,rpc(msg.id,{isError:true,content:[{type:"text",text:"Operazione non autorizzata o non riuscita"}]}));}
    }
    return respond(res,200,{jsonrpc:"2.0",id:msg.id??null,error:{code:-32601,message:"Method not found"}});
  };
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href)createServer(handler()).listen(Number(process.env.PORT||8787),"127.0.0.1");
