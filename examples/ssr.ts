import { MemorySession, createClient } from "rustabase";
export function serverClient(url:string,cookie:string){const session=new MemorySession();session.loadCookie(cookie);return createClient(url,{session})}
