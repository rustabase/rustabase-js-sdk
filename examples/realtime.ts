import { createClient } from "rustabase";
const rb=createClient("https://app.example.com",{credentials:"include"});
export const subscribe=()=>rb.from("posts").subscribe("*",event=>console.log(event.action,event.record));
