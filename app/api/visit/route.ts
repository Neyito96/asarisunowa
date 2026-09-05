import { getDb } from "../../../db";import { visits } from "../../../db/schema";
export async function POST(req:Request){const x=await req.json() as Record<string,string>;if(!x.visitorKey)return Response.json({error:"invalid"},{status:400});await getDb().insert(visits).values({visitorKey:x.visitorKey.slice(0,100),path:(x.path||"/").slice(0,100)});return Response.json({ok:true},{status:201})}
