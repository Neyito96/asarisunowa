import { getDb } from "../../../db";import { outboundClicks } from "../../../db/schema";
export async function POST(req:Request){const x=await req.json() as {playlistId?:string};if(!x.playlistId)return Response.json({error:"invalid"},{status:400});await getDb().insert(outboundClicks).values({playlistId:x.playlistId});return Response.json({ok:true},{status:201})}
